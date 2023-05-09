use anyhow::Context;
use colored::Colorize;

use ethereum_types::Address;
use foundry_evm::executor::{fork::MultiFork, Backend, ExecutorBuilder, RawCallResult};
use halo2_curves::bn256::{Bn256, Fq, Fr, G1Affine};
use halo2_kzg_srs::{Srs, SrsFormat};
use halo2_proofs::{
    circuit::{floor_planner::V1, Layouter, Value},
    dev::MockProver,
    plonk::{
        self, create_proof, keygen_pk, keygen_vk, verify_proof, Circuit, ConstraintSystem,
        ProvingKey, VerifyingKey as PlonkVerifyingKey,
    },
    poly::{
        commitment::{Params, ParamsProver},
        kzg::{
            commitment::{KZGCommitmentScheme, ParamsKZG},
            multiopen::{ProverGWC, VerifierGWC},
            strategy::AccumulatorStrategy,
        },
        VerificationStrategy,
    },
    transcript::{EncodedChallenge, TranscriptReadBuffer, TranscriptWriterBuffer},
};
use halo2_wrong_ecc::{
    self,
    integer::rns::Rns,
    maingate::{
        MainGate, MainGateConfig, MainGateInstructions, RangeChip, RangeConfig, RangeInstructions,
        RegionCtx,
    },
    EccConfig,
};
use halo2_wrong_transcript::NativeRepresentation;
use itertools::Itertools;
use plonk_verifier::{
    cost::CostEstimation,
    loader::{
        evm::{encode_calldata, EvmLoader},
        halo2::{self},
        native::NativeLoader,
    },
    pcs::{
        kzg::{
            Gwc19, Kzg, KzgAccumulator, KzgAs, KzgAsProvingKey, KzgAsVerifyingKey,
            KzgSuccinctVerifyingKey, LimbsEncoding,
        },
        AccumulationScheme, AccumulationSchemeProver, Decider,
    },
    system::{
        self,
        circom::{compile, Proof, PublicSignals, VerifyingKey},
        halo2::{compile as compile_halo2, transcript::evm::EvmTranscript, Config},
    },
    util::arithmetic::{fe_to_limbs, CurveAffine, FieldExt},
    verifier::{self, PlonkVerifier},
    Protocol,
};
use rand::{rngs::OsRng, SeedableRng};
use rand_chacha::ChaCha20Rng;
use serde_json;
use serde::{Serialize, Deserialize};
use std::{
    io::{Cursor, Write},
    iter,
    path::PathBuf,
    rc::Rc,
    time::Instant, string,
};
use utils::DimensionMeasurement;

mod utils;

const LIMBS: usize = 4;
const BITS: usize = 68;
const T: usize = 17;
const RATE: usize = 16;
const R_F: usize = 8;
const R_P: usize = 10;

type Pcs = Kzg<Bn256, Gwc19>;
type Svk = KzgSuccinctVerifyingKey<G1Affine>;
type As = KzgAs<Pcs>;
type AsPk = KzgAsProvingKey<G1Affine>;
type AsVk = KzgAsVerifyingKey;
type Plonk = verifier::Plonk<Pcs, LimbsEncoding<LIMBS, BITS>>;

type BaseFieldEccChip = halo2_wrong_ecc::BaseFieldEccChip<G1Affine, LIMBS, BITS>;
type Halo2Loader<'a> = halo2::Halo2Loader<'a, G1Affine, Fr, BaseFieldEccChip>;
type PoseidonTranscript<L, S, B> = system::circom::transcript::halo2::PoseidonTranscript<
    G1Affine, Fr, NativeRepresentation, L, S, B, LIMBS, BITS, T, RATE, R_F, R_P,>;

#[derive(Clone)]
pub struct MainGateWithRangeConfig {
    main_gate_config: MainGateConfig,
    range_config: RangeConfig,
}

impl MainGateWithRangeConfig {
    pub fn configure<F: FieldExt>(
        meta: &mut ConstraintSystem<F>,
        composition_bits: Vec<usize>,
        overflow_bits: Vec<usize>,
    ) -> Self {
        let main_gate_config = MainGate::<F>::configure(meta);
        let range_config =
            RangeChip::<F>::configure(meta, &main_gate_config, composition_bits, overflow_bits);
        MainGateWithRangeConfig {
            main_gate_config,
            range_config,
        }
    }

    pub fn main_gate<F: FieldExt>(&self) -> MainGate<F> {
        MainGate::new(self.main_gate_config.clone())
    }

    pub fn range_chip<F: FieldExt>(&self) -> RangeChip<F> {
        RangeChip::new(self.range_config.clone())
    }

    pub fn ecc_chip<C: CurveAffine, const LIMBS: usize, const BITS: usize>(
        &self,
    ) -> halo2_wrong_ecc::BaseFieldEccChip<C, LIMBS, BITS> {
        halo2_wrong_ecc::BaseFieldEccChip::new(EccConfig::new(
            self.range_config.clone(),
            self.main_gate_config.clone(),
        ))
    }
}

#[derive(Clone)]
pub struct SnarkWitness {
    protocol: Protocol<G1Affine>,
    instances: Vec<Vec<Value<Fr>>>,
    proof: Value<Vec<u8>>,
}

impl SnarkWitness {
    pub fn without_witnesses(&self) -> Self {
        SnarkWitness {
            protocol: self.protocol.clone(),
            instances: self
                .instances
                .iter()
                .map(|instances| vec![Value::unknown(); instances.len()])
                .collect(),
            proof: Value::unknown(),
        }
    }

    pub fn proof(&self) -> Value<&[u8]> {
        self.proof.as_ref().map(Vec::as_slice)
    }
}

pub fn accumulate<'a>(
    svk: &Svk,
    loader: &Rc<Halo2Loader<'a>>,
    snarks: &[SnarkWitness],
    as_vk: &AsVk,
    as_proof: Value<&'_ [u8]>,
) -> KzgAccumulator<G1Affine, Rc<Halo2Loader<'a>>> {
    let assign_instances = |instances: &[Vec<Value<Fr>>]| {
        instances
            .iter()
            .map(|instances| {
                instances
                    .iter()
                    .map(|instance| loader.assign_scalar(*instance))
                    .collect_vec()
            })
            .collect_vec()
    };

    let mut accumulators = snarks
        .iter()
        .flat_map(|snark| {
            let instances = assign_instances(&snark.instances);
            let mut transcript =
                PoseidonTranscript::<Rc<Halo2Loader>, _, _>::new(loader, snark.proof());
            let proof =
                Plonk::read_proof(svk, &snark.protocol, &instances, &mut transcript).unwrap();
            Plonk::succinct_verify(svk, &snark.protocol, &instances, &proof).unwrap()
        })
        .collect_vec();

    let accumulator = if accumulators.len() > 1 {
        let mut transcript = PoseidonTranscript::<Rc<Halo2Loader>, _, _>::new(loader, as_proof);
        let proof = As::read_proof(as_vk, &accumulators, &mut transcript).unwrap();
        As::verify(as_vk, &accumulators, &proof).unwrap()
    } else {
        accumulators.pop().unwrap()
    };

    accumulator
}

#[derive(Clone)]
struct Accumulation {
    svk: Svk,
    snarks: Vec<SnarkWitness>,
    instances: Vec<Fr>,
    as_vk: AsVk,
    as_proof: Value<Vec<u8>>,
}

impl Accumulation {
    pub fn new(
        vk: VerifyingKey<Bn256>,
        public_signals: Vec<PublicSignals<Fr>>,
        proofs: Vec<Proof<Bn256>>,
    ) -> Self {
        println!("{}", format!("Building aggregation circuit for {} proofs", proofs.len()).white().bold());
        let protocol = compile(&vk);
        let proofs: Vec<Vec<u8>> = proofs.iter().map(|p| p.to_compressed_le()).collect();

        let mut accumulators = public_signals
            .iter()
            .zip(proofs.iter())
            .flat_map(|(public_signal, proof)| {
                let instances = [public_signal.clone().to_vec(); 1];
                let mut transcript =
                    PoseidonTranscript::<NativeLoader, _, _>::new(proof.as_slice());
                let proof =
                    Plonk::read_proof(&vk.svk().into(), &protocol, &instances, &mut transcript)
                        .unwrap();
                Plonk::succinct_verify(&vk.svk().into(), &protocol, &instances, &proof).unwrap()
            })
            .collect_vec();

        let as_pk = AsPk::new(Some(vk.apk()));
        let (accumulator, as_proof) = if accumulators.len() > 1 {
            let mut transcript = PoseidonTranscript::<NativeLoader, _, _>::new(Vec::new());
            let accumulator = As::create_proof(
                &as_pk,
                &accumulators,
                &mut transcript,
                ChaCha20Rng::from_seed(Default::default()),
            )
            .unwrap();
            (accumulator, Value::known(transcript.finalize()))
        } else {
            (accumulators.pop().unwrap(), Value::unknown())
        };

        assert!(Pcs::decide(&vk.dk().into(), accumulator.clone()));

        let KzgAccumulator { lhs, rhs } = accumulator;
        let instances = [lhs.x, lhs.y, rhs.x, rhs.y]
            .map(fe_to_limbs::<_, _, LIMBS, BITS>)
            .concat();

        Self {
            svk: vk.svk().into(),
            snarks: public_signals
                .into_iter()
                .zip(proofs)
                .map(|(public_signals, proof)| SnarkWitness {
                    protocol: protocol.clone(),
                    instances: vec![public_signals
                        .to_vec()
                        .into_iter()
                        .map(Value::known)
                        .collect_vec()],
                    proof: Value::known(proof),
                })
                .collect(),
            instances,
            as_vk: as_pk.vk(),
            as_proof,
        }
    }

    pub fn accumulator_indices() -> Vec<(usize, usize)> {
        (0..4 * LIMBS).map(|idx| (0, idx)).collect()
    }

    pub fn instances(&self) -> Vec<Vec<Fr>> {
        vec![self.instances.clone()]
    }

    pub fn num_instance() -> Vec<usize> {
        vec![4 * LIMBS]
    }

    pub fn as_proof(&self) -> Value<&[u8]> {
        self.as_proof.as_ref().map(Vec::as_slice)
    }
}

impl Circuit<Fr> for Accumulation {
    type Config = MainGateWithRangeConfig;
    type FloorPlanner = V1;

    fn without_witnesses(&self) -> Self {
        Self {
            svk: self.svk,
            snarks: self
                .snarks
                .iter()
                .map(SnarkWitness::without_witnesses)
                .collect(),
            instances: self.instances.clone(),
            as_vk: self.as_vk,
            as_proof: Value::unknown(),
        }
    }

    fn configure(meta: &mut ConstraintSystem<Fr>) -> Self::Config {
        MainGateWithRangeConfig::configure::<Fr>(
            meta,
            vec![BITS / LIMBS],
            Rns::<Fq, Fr, LIMBS, BITS>::construct().overflow_lengths(),
        )
    }

    fn synthesize(
        &self,
        config: Self::Config,
        mut layouter: impl Layouter<Fr>,
    ) -> Result<(), plonk::Error> {
        let main_gate = config.main_gate();
        let range_chip = config.range_chip();

        range_chip.load_table(&mut layouter)?;

        let (lhs, rhs) = layouter.assign_region(
            || "",
            |region| {
                let ctx = RegionCtx::new(region, 0);

                let ecc_chip = config.ecc_chip();
                let loader = Halo2Loader::new(ecc_chip, ctx);
                let KzgAccumulator { lhs, rhs } = accumulate(
                    &self.svk,
                    &loader,
                    &self.snarks,
                    &self.as_vk,
                    self.as_proof(),
                );

                // loader.print_row_metering();
                // println!("Total row cost: {}", loader.ctx().offset());

                Ok((lhs.assigned(), rhs.assigned()))
            },
        )?;

        for (limb, row) in iter::empty()
            .chain(lhs.x().limbs())
            .chain(lhs.y().limbs())
            .chain(rhs.x().limbs())
            .chain(rhs.y().limbs())
            .zip(0..)
        {
            main_gate.expose_public(layouter.namespace(|| ""), limb.into(), row)?;
        }

        Ok(())
    }
}

fn gen_proof<
    C: Circuit<Fr>,
    E: EncodedChallenge<G1Affine>,
    TR: TranscriptReadBuffer<Cursor<Vec<u8>>, G1Affine, E>,
    TW: TranscriptWriterBuffer<Vec<u8>, G1Affine, E>,
>(
    params: &ParamsKZG<Bn256>,
    pk: &ProvingKey<G1Affine>,
    circuit: C,
    instances: Vec<Vec<Fr>>,
) -> (Vec<u8>, bool) {
    MockProver::run(params.k(), &circuit, instances.clone())
        .unwrap()
        .assert_satisfied();

    let instances = instances
        .iter()
        .map(|instances| instances.as_slice())
        .collect_vec();
    let proof = {
        let mut transcript = TW::init(Vec::new());
        create_proof::<KZGCommitmentScheme<Bn256>, ProverGWC<_>, _, _, TW, _>(
            params,
            pk,
            &[circuit],
            &[instances.as_slice()],
            OsRng,
            &mut transcript,
        )
        .unwrap();
        transcript.finalize()
    };

    let accept = {
        let mut transcript = TR::init(Cursor::new(proof.clone()));
        VerificationStrategy::<_, VerifierGWC<_>>::finalize(
            verify_proof::<_, VerifierGWC<_>, _, TR, _>(
                params.verifier_params(),
                pk.get_vk(),
                AccumulatorStrategy::new(params.verifier_params()),
                &[instances.as_slice()],
                &mut transcript,
            )
            .unwrap(),
        )
    };

    (proof, accept)
}

fn gen_pk<C: Circuit<Fr>>(params: &ParamsKZG<Bn256>, circuit: &C) -> ProvingKey<G1Affine> {
    println!("{}", "gen_pk".white().bold());
    let vk = keygen_vk(params, circuit).unwrap();
    keygen_pk(params, vk, circuit).unwrap()
}

fn gen_aggregation_evm_verifier(
    vk: &VerifyingKey<Bn256>,
    params: &ParamsKZG<Bn256>,
    plonk_vk: &PlonkVerifyingKey<G1Affine>,
    num_instance: Vec<usize>,
    accumulator_indices: Vec<(usize, usize)>,
) -> Vec<u8> {
    let svk = vk.svk().into();
    let dk = vk.dk().into();

    let protocol = compile_halo2(
        params,
        plonk_vk,
        Config::kzg()
            .with_num_instance(num_instance.clone())
            .with_accumulator_indices(accumulator_indices),
    );

    verifier::Plonk::<Kzg<Bn256, Gwc19>>::estimate_cost(&protocol);

    let loader = EvmLoader::new::<Fq, Fr>();
    let mut transcript = EvmTranscript::<_, Rc<EvmLoader>, _, _>::new(loader.clone());

    let instances = transcript.load_instances(num_instance);
    let proof = Plonk::read_proof(&svk, &protocol, &instances, &mut transcript).unwrap();
    Plonk::verify(&svk, &dk, &protocol, &instances, &proof).unwrap();

    loader.deployment_code()
}

fn evm_verify(deployment_code: Vec<u8>, calldata: Vec<u8>) -> anyhow::Result<RawCallResult> {
    println!("{}", "Simulating evm verification".white().bold());
    let mut evm = ExecutorBuilder::default()
        .with_gas_limit(u64::MAX.into())
        .build(Backend::new(MultiFork::new().0, None));

    let caller = Address::from_low_u64_be(0xfe);
    let verifier = evm.deploy(caller, deployment_code.into(), 0.into(), None)?;
    match evm.call_raw(caller, verifier.address, calldata.into(), 0.into()) {
        Ok(result) => Ok(result),
        Err(e) => Err(anyhow::anyhow!(e.to_string())),
    }
}

fn prepare_params(path: PathBuf) -> anyhow::Result<ParamsKZG<Bn256>> {
    println!("{}", "Reading parameters for commitment scheme".white().bold());
    let params = match path.extension() {
        Some(ext) => match ext.to_str().unwrap() {
            "srs" => Ok(Srs::<Bn256>::read(
                &mut std::fs::File::open(path.clone()).with_context(|| {
                    format!("Failed to read .srs file {}", path.to_str().unwrap())
                })?,
                SrsFormat::Pse,
            )),
            _ => Err(anyhow::Error::msg(
                "Invalid file extension. Only .ptau or .srs files allowed for params",
            )),
        },
        None => Err(anyhow::Error::msg("Invalid file path for params")),
    }
    .and_then(|srs| {
        let mut buf = Vec::new();
        srs.write(&mut buf);
        let params = ParamsKZG::<Bn256>::read(&mut std::io::Cursor::new(buf))
            .with_context(|| "Malformed params file")?;
        Ok(params)
    })?;

    Ok(params)
}

fn prepare_circom_vk(path: PathBuf) -> anyhow::Result<VerifyingKey<Bn256>> {
    let vk = std::fs::read_to_string(&path).with_context(|| {
        format!(
            "Failed to locate verification key at {}",
            path.to_str().unwrap()
        )
    })?;
    let vk: VerifyingKey<Bn256> =
        serde_json::from_str(vk.as_str()).with_context(|| "Malformed verification key")?;
    Ok(vk)
}

fn prepare_proofs(path: PathBuf) -> anyhow::Result<Vec<Proof<Bn256>>> {
    let str = std::fs::read_to_string(path.clone())
        .with_context(|| format!("Failed to locate {}", path.to_str().unwrap()))?;
    let proofs = serde_json::from_str::<Vec<Proof<Bn256>>>(&str)?;
    Ok(proofs)
}

fn prepare_public_signals(path: PathBuf) -> anyhow::Result<Vec<PublicSignals<Fr>>> {
    let str = std::fs::read_to_string(path.clone())
        .with_context(|| format!("Failed to locate {}", path.to_str().unwrap()))?;
    let public_signals = serde_json::from_str::<Vec<PublicSignals<Fr>>>(&str)?;
    Ok(public_signals)
}

fn report_elapsed(now: Instant) {
    println!(
        "{}",
        format!("Took {} seconds", now.elapsed().as_secs())
            .blue()
            .bold()
    );
}

fn main() {
    println!("main of maze!!!...");
}

// #[derive(Debug, Serialize, Deserialize)]
// struct se {
//     name : string,
//     id : u32
// }

#[test]
fn fullprocess() {

    const PROOF_CALLDAT_FROM_FILE : bool = true;
    const BYTECODE_FROM_FILE : bool = true;
    const MOCK_PROVE_VERIFY : bool = false;

    let circom_vk = prepare_circom_vk(PathBuf::from("/Users/sam/zkvote-contract/maze/maze-cli/testdata/verification_key.json")).unwrap();
    let proofs = prepare_proofs(PathBuf::from("/Users/sam/zkvote-contract/maze/maze-cli/testdata/proofs.json")).unwrap();
    let public_signals = prepare_public_signals(PathBuf::from("/Users/sam/zkvote-contract/maze/maze-cli/testdata/public_signals.json")).unwrap();

    let circuit = Accumulation::new(circom_vk.clone(), public_signals, proofs);
    if MOCK_PROVE_VERIFY {
        let now = Instant::now();
        let dimension = DimensionMeasurement::measure(&circuit).unwrap();
        // 21 works, takes 1min(release)/10mins(debug) for generate proof.
        let mock_prover = MockProver::run(dimension.k(), &circuit, vec![circuit.instances.clone()]).unwrap();
        mock_prover.verify().unwrap();
        report_elapsed(now);
        return
    }

    let params : ParamsKZG<Bn256>;
    let pk : ProvingKey<G1Affine>;
    let calldata : Vec<u8>;
    let evm_bytecode : Vec<u8>;

    if !BYTECODE_FROM_FILE {
        let now = Instant::now();
        // read in memory take a long time, using srs(1min) instead of ptau
        params = prepare_params(PathBuf::from("/Users/sam/ptau/hermez-21.srs")).unwrap();
        report_elapsed(now);

        let now = Instant::now();
        pk = gen_pk(&params, &circuit);
        report_elapsed(now);
    // }

    // if false {
        println!("{}", "Generating proof".white().bold());
        let now = Instant::now();
        let (proof, is_valid) = gen_proof::<
            _,
            _,
            EvmTranscript<G1Affine, _, _, _>,
            EvmTranscript<G1Affine, _, _, _>,
        >(
            &params, &pk, circuit.clone(), circuit.instances()
        );
        report_elapsed(now);
        if !is_valid {
            println!("{}", "Invalid proof generation".red().bold());
        }
        let file_path = PathBuf::from("/Users/sam/zkvote-contract/maze/maze-cli/testdata/halo2-agg-proof.txt");
        let mut file = std::fs::File::create(file_path.clone()).unwrap();
        file.write_all(&proof.clone()).unwrap();

        calldata = encode_calldata(&circuit.instances(), &proof);
        let file_path = PathBuf::from("/Users/sam/zkvote-contract/maze/maze-cli/testdata/halo2-agg-evm-calldata.txt");
        let mut file = std::fs::File::create(file_path.clone()).unwrap();
        file.write_all(&calldata.clone()).unwrap();

        let verification_key = pk.get_vk();
        evm_bytecode = gen_aggregation_evm_verifier(
            &circom_vk,
            &params,
            verification_key,
            Accumulation::num_instance(),
            Accumulation::accumulator_indices(),
        );
        let file_path = PathBuf::from("/Users/sam/zkvote-contract/maze/maze-cli/testdata/halo2-agg-bytecode.txt");
        let mut file = std::fs::File::create(file_path.clone()).unwrap();
        file.write_all(&evm_bytecode.clone()).unwrap();
    } else {
        println!("{}", "Readding Bytecode".white().bold());
        let file_path = PathBuf::from("/Users/sam/zkvote-contract/maze/maze-cli/testdata/halo2-agg-bytecode.txt");
        evm_bytecode = std::fs::read(file_path).unwrap();
        
        let calldata_path = PathBuf::from("/Users/sam/zkvote-contract/maze/maze-cli/testdata/halo2-agg-evm-calldata.txt");
        calldata = std::fs::read(calldata_path).unwrap();
    }

    let result = evm_verify(evm_bytecode, calldata.clone()).unwrap();
    println!("result : {:?}", result);
    println!("{}", format!("Gas used: {}", result.gas_used).blue());
    if result.reverted {
        println!("{}", "Verification failed".red())
    } else {
        println!("{}", "Verification success".green())
    }
}

// TODO :
// 1. EVM Verify Fail : PSE snarkjs ?