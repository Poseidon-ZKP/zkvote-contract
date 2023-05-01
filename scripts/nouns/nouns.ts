import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Nouns__factory, Round2Verifier__factory, NvoteVerifier__factory } from "../types";
// import { Round2PlonkVerifier__factory } from "../types/factories/contracts/round2/round2_plonk_verifier.sol";
// import { poseidonDec, poseidonEnc } from "./poseidon";
// import { generate_zkp_nvote} from "./prover";
import { round1 } from "./round1";
import { round2 } from "./round2";
const { buildBabyjub, buildPoseidonReference } = require('circomlibjs');
const polyval = require( 'compute-polynomial' );

async function main(
) {
    // init
    const jub = await buildBabyjub()
    const poseidon = await buildPoseidonReference();
    const owners = await ethers.getSigners()
    let deployer : SignerWithAddress = owners[0]

    // const accounts: any = hre.config.networks.hardhat.accounts;
    // for (let index = 0; index < owners.length; index++) {
    //   const wallet = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${index}`);
    //   console.log("`", wallet.privateKey + "`,")
    // }

    // Parameters
    const V = [1, 2, 3]        // voting power per user
    const N_USER = V.length
    const N_COM = 3
    const t = 2
    let COMMITEE = []
    for (let i = 0; i < N_COM; i++) {
        COMMITEE.push(owners[i])
    }

    // const r2v = await (new Round2PlonkVerifier__factory(deployer)).deploy()
    const r2v = await (new Round2Verifier__factory(deployer)).deploy()
    console.log("r2v: " + r2v.address);
    const nvv = await (new NvoteVerifier__factory(deployer)).deploy()
    console.log("nvv: " + nvv.address);
    const verifiers = [r2v.address, nvv.address]
    const nc = await (new Nouns__factory(deployer)).deploy(
        verifiers,
        COMMITEE.map((e) => e.address),
        COMMITEE.map((e) => e.address),
        V,
        t
    )

    // 1. Key Generation Round 1 (Committee)

    // const {a, C, edwards_twist_C, PK} = await round1(jub, COMMITEE, t, nc)
    // console.log("PK : ", [jub.F.toString(PK[0]), jub.F.toString(PK[1])])
    const round1_result = await round1(jub, poseidon, COMMITEE, t, nc);
    const members = round1_result.members;
    console.log("members_round1: " + members.map(x => x.toString()));

    // 2. Key Generation Round 2 (Committee)
    const round2_result = await round2(nc, round1_result);

    // // 3. User Voting
    // let o = []
    // let r = []
    // let R = []
    // let R_SUM = [jub.F.e("0"), jub.F.e("1")]
    // let M = []
    // let M_SUM = [
    //   [jub.F.e("0"), jub.F.e("1")],
    //   [jub.F.e("0"), jub.F.e("1")],
    //   [jub.F.e("0"), jub.F.e("1")]
    // ]
    // for (let i = 0; i < N_USER; i++) {
    //     r.push(Math.floor(Math.random() * 10000)) // TODO: * jub.order)
    //     R.push(jub.mulPointEscalar(jub.Generator, r[i]))
    //     R_SUM = jub.addPoint(R_SUM, R[i])

    //     let m = jub.mulPointEscalar(PK, r[i])
    //     let vm = jub.addPoint(m, jub.mulPointEscalar(jub.Generator, V[i]))

    //     if (i % 3 == 0) {
    //       o.push(0b100)  // yes
    //       M.push([m, m, vm]);
    //     } else if (i % 3 == 1) {
    //       o.push(0b010)  // no
    //       M.push([m, vm, m]);
    //     } else {
    //       o.push(0b001)  // abstain
    //       M.push([vm, m, m]);
    //     }

    //     const {proof, publicSignals} = await generate_zkp_nvote(edwards_twist_PK, V[i], r[i], o[i])

    //     await (await nc.connect(COMMITEE[i]).vote(
    //       [publicSignals.R[0], publicSignals.R[1]],
    //       [
    //         [publicSignals.M[0][0], publicSignals.M[0][1]],
    //         [publicSignals.M[1][0], publicSignals.M[1][1]],
    //         [publicSignals.M[2][0], publicSignals.M[2][1]]
    //       ],
    //         proof
    //     )).wait()

    //     for (let j = 0; j < 3; j++) {
    //       expect(jub.F.toString(M[i][j][0])).equal(publicSignals.M[j][0]);
    //       M_SUM[j] = jub.addPoint(M_SUM[j], M[i][j])
    //     }
    //     console.log("nvote on-chain verify done!!")
    // }
    // expect(jub.F.toString(R_SUM[0])).equal(await nc.R(0))
    // for (let j = 0; j < 3; j++) {
    //     expect(jub.F.toString(M_SUM[j][0])).equal(await nc.M(j, 0));
    // }

    // // 4. Tally & Reveal
    // const D = []
    // for (let i = 0; i < t; i++) {
    //     D.push(jub.mulPointEscalar(R_SUM, sk[i]))
    //     await (await nc.connect(COMMITEE[i]).tally([jub.F.toString(D[i][0]), jub.F.toString(D[i][1])])).wait()
    // }

    // console.log("Reveal Results : ")
    // console.log("Yes : ", await nc.voteStats(0))
    // console.log("No : ", await nc.voteStats(1))
    // console.log("Abstain : ", await nc.voteStats(2))
    // // expect(await nc.voteStats(0)).equal(V[0])

}


main()
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});
