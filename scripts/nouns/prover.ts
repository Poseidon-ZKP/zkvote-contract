import { PublicKey } from "../crypto";
import { expect } from "chai";
import { BigNumberish } from "ethers";
import * as snarkjs from "snarkjs"

function circuit_paths(circuit_name: string): { wasm: string, zkey: string } {
  const pwd = process.cwd();
  const artifact_dir = pwd + "/artifacts/circuits/" + circuit_name + "/";
  return {
    wasm: artifact_dir + circuit_name + "_js/" + circuit_name + ".wasm",
    zkey: artifact_dir + circuit_name + ".zkey.16",
  };
}


export type PlonkSolidityProof = [
  BigNumberish,
  BigNumberish,
  BigNumberish,
  BigNumberish,
  BigNumberish,
  BigNumberish,
  BigNumberish,
  BigNumberish
]


export default function packPlonkProofToSolidityProof(proof): PlonkSolidityProof {
  return [
    proof.pi_a[0],
    proof.pi_a[1],
    proof.pi_b[0][1],
    proof.pi_b[0][0],
    proof.pi_b[1][1],
    proof.pi_b[1][0],
    proof.pi_c[0],
    proof.pi_c[1]
  ]
}


export type Groth16Proof = {
  pi_a: bigint[];
  pi_b: bigint[][];
  pi_c: bigint[];
}


export type Groth16SolidityProof = {
  a: [BigNumberish, BigNumberish];
  b: [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]];
  c: [BigNumberish, BigNumberish];
}


export function packGroth16ProofToSolidityProof(proof: Groth16Proof): Groth16SolidityProof {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
  }
}


// async function zkp_test() {
//   const DIR = process.cwd()
//   const CUR_CIRCUIT = "nouns"
//   const CIRCUIT_TGT_DIR = DIR + "/circuits/" + CUR_CIRCUIT + "/"
//   const FILE_WASM = CIRCUIT_TGT_DIR + CUR_CIRCUIT + "_js/" + CUR_CIRCUIT + ".wasm"
//   const FILE_ZKEY = CIRCUIT_TGT_DIR + "zkey.16"

//   const { proof, publicSignals } = await snarkjs.groth16.fullProve(
//       {
//           in : 8,
//           p : [
//             '995203441582195749578291179787384436505546430278305826713579947235728471134',
//             '5472060717959818805561601436314318772137091100104008585924551046643952123905'
//           ],
//       },
//       FILE_WASM,
//       FILE_ZKEY
//   )

//   exit(0)
//   const vKey = await snarkjs.zKey.exportVerificationKey(FILE_ZKEY);
//   // expect([publicSignals[0], [publicSignals[1]].equal(jub.Generator))
//   // expect([publicSignals[2], [publicSignals[3]].equal(jub.Generator))
//   expect(await snarkjs.groth16.verify(
//     vKey,
//     [
//         publicSignals[0],   // G = 1 * G
//         publicSignals[1],
//         publicSignals[2],   // B = 8 * G
//         publicSignals[3]
//     ],
//     proof
//   )).eq(true)
//   exit(0)
// }

export async function generate_zkp_round2(
  recip_id: number,
  recip_PK: PublicKey,
  C: PublicKey[],
  f_l: bigint,
  PK_i_l: PublicKey,
  eph_sk: bigint,
  enc: bigint,
  eph_pk: PublicKey,
): Promise<{ proof: Groth16SolidityProof }> {
  const { wasm, zkey } = circuit_paths("round2");

  // const vKey_promise = snarkjs.zKey.exportVerificationKey(zkey);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      // Public
      recip_id: recip_id,
      recip_PK: recip_PK,
      PK_i_l: PK_i_l,
      enc: enc,
      eph_pk: eph_pk,
      C: C,
      // Secret
      f_l: f_l,
      eph_sk: eph_sk,
    },
    wasm,
    zkey
  )

  // console.log("groth16 proof: " + JSON.stringify(proof));

  // expect(await snarkjs.groth16.verify(
  //   await vKey_promise,
  //   publicSignals,
  //   proof
  // )).eq(true)

  // console.log("round2 groth16 prover done!")

  const sol_proof = packGroth16ProofToSolidityProof(proof);
  // console.log("groth16 sol_proof: " + JSON.stringify(sol_proof));
  return { proof: sol_proof };
}

// export async function generate_plonk_zkp_round2(
//     recip_id: number,
//     recip_PK: PublicKey,
//     C: PublicKey[],
//     f_l: bigint,
//     eph_sk: bigint,
//     enc: bigint,
//     eph_pk: PublicKey,
// ) {
//   const DIR = process.cwd()
//   const CUR_CIRCUIT = "round2"
//   const CIRCUIT_TGT_DIR = DIR + "/circuits/" + CUR_CIRCUIT + "/"
//   const FILE_WASM = CIRCUIT_TGT_DIR + CUR_CIRCUIT + "_js/" + CUR_CIRCUIT + ".wasm"
//   const FILE_ZKEY = CIRCUIT_TGT_DIR + "zkey.plonk.16"
//   const vKey = await snarkjs.zKey.exportVerificationKey(FILE_ZKEY);

//   const { proof, publicSignals } = await snarkjs.plonk.fullProve(
//     {
//       // Public
//       recip_id: recip_id,
//       recip_PK: recip_PK,
//       C: C,
//       enc: enc,
//       eph_pk: eph_pk,
//       // Secret
//       f_l : f_l,
//       eph_sk : eph_sk,
//     },
//     FILE_WASM,
//     FILE_ZKEY
//   )

//   if (publicSignals.length != 6 + (C.length*2)) { throw "unexpected length"; }

//   expect(await snarkjs.plonk.verify(
//     vKey,
//     publicSignals,
//     // [
//     //     publicSignals[0],   // out
//     //     publicSignals[1],
//     //     publicSignals[2],   // enc
//     //     publicSignals[3],   // kb[2]
//     //     publicSignals[4],
//     //     publicSignals[5],   // l
//     //     publicSignals[6],   // C[i]
//     //     publicSignals[7],
//     //     publicSignals[8],
//     //     publicSignals[9],
//     //     publicSignals[10],  // C[L][0]
//     //     publicSignals[11]
//     // ],
//     proof
//   )).eq(true)

//   console.log("round2 plonk prover done!")

//   const input_pub = await snarkjs.plonk.exportSolidityCallData(proof, publicSignals)
//   return {
//     proof : input_pub.split(",[")[0],
//     // publicSignals: {
//     //   l : l,
//     //   C : C,
//     //   CL0 : CL0,
//     //   enc : publicSignals[2],
//     //   kb : [publicSignals[3], publicSignals[4]],
//     //   out : [publicSignals[0], publicSignals[1]]
//     // }
//   }
// }

export async function generate_zkp_nvote(
  PK: PublicKey,
  votePower: bigint,
  Rs: PublicKey[],
  Ms: PublicKey[],
  o: bigint,
  rs: bigint[],
): Promise<{ proof: Groth16SolidityProof }> {
  const { wasm, zkey } = circuit_paths("nvote");

  const vKey_promise = snarkjs.zKey.exportVerificationKey(zkey);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      PK: PK,
      votePower: votePower,
      R: Rs,
      M: Ms,
      o: o,
      r: rs,
    },
    wasm,
    zkey
  )

  const expect_num_inputs = 2 + 1 + 2 * 3 + 2 * 3;
  expect(publicSignals.length).to.equal(expect_num_inputs);
  expect(await snarkjs.groth16.verify(
    await vKey_promise,
    publicSignals,
    // [
    //     publicSignals[0],   // R
    //     publicSignals[1],
    //     publicSignals[2],   // M
    //     publicSignals[3],
    //     publicSignals[4],
    //     publicSignals[5],
    //     publicSignals[6],
    //     publicSignals[7],
    //     publicSignals[8],   // PK
    //     publicSignals[9],
    //     publicSignals[10]   // vote power
    // ],
    proof
  )).eq(true)

  console.log("nvote prover done!")

  return { proof: packGroth16ProofToSolidityProof(proof) }
}


export async function generate_zkp_tally(
  PK_i: PublicKey,
  R: PublicKey[],
  D_i: PublicKey[],
  sk_i: bigint,
): Promise<{ proof: Groth16SolidityProof }> {
  const { wasm, zkey } = circuit_paths("tally");

  const vKey_promise = snarkjs.zKey.exportVerificationKey(zkey);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      PK_i: PK_i,
      R: R,
      D_i: D_i,
      sk_i: sk_i,
    },
    wasm,
    zkey
  )

  const expect_num_inputs = 2 + 2 * 3 + 2 * 3; // PK_i, R, D_i
  expect(publicSignals.length).to.equal(expect_num_inputs);
  expect(await snarkjs.groth16.verify(
    await vKey_promise,
    publicSignals,
    proof
  )).eq(true)

  console.log("tally prover done!")

  return { proof: packGroth16ProofToSolidityProof(proof) }
}
