const { buildBabyjub } = require('circomlibjs');
const polyval = require( 'compute-polynomial' );
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { exit } from "process";
import * as snarkjs from "snarkjs"
import { Nouns__factory } from "./types";

async function jub_test() {
    const jub = await buildBabyjub()
    return jub
}

async function zkp_test() {
  const DIR = process.cwd()
  const CUR_CIRCUIT = "nouns"
  const CIRCUIT_TGT_DIR = DIR + "/circuits/" + CUR_CIRCUIT + "/"
  const FILE_WASM = CIRCUIT_TGT_DIR + CUR_CIRCUIT + "_js/" + CUR_CIRCUIT + ".wasm"
  const FILE_ZKEY = CIRCUIT_TGT_DIR + "zkey.16"

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
          a : [1, 8]
      },
      FILE_WASM,
      FILE_ZKEY
  )

  console.log("prover publicSignals : ", publicSignals)
  const vKey = await snarkjs.zKey.exportVerificationKey(FILE_ZKEY);
  // expect([publicSignals[0], [publicSignals[1]].equal(jub.Generator))
  // expect([publicSignals[2], [publicSignals[3]].equal(jub.Generator))
  expect(await snarkjs.groth16.verify(
    vKey,
    [
        publicSignals[0],   // G = 1 * G
        publicSignals[1],
        publicSignals[2],   // B = 8 * G
        publicSignals[3]
    ],
    proof
  )).eq(true)
  exit(0)
}

async function zkp_round2() {
  const DIR = process.cwd()
  const CUR_CIRCUIT = "round2"
  const CIRCUIT_TGT_DIR = DIR + "/circuits/" + CUR_CIRCUIT + "/"
  const FILE_WASM = CIRCUIT_TGT_DIR + CUR_CIRCUIT + "_js/" + CUR_CIRCUIT + ".wasm"
  const FILE_ZKEY = CIRCUIT_TGT_DIR + "zkey.16"
  const vKey = await snarkjs.zKey.exportVerificationKey(FILE_ZKEY);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
          f_l : 8,
          l : 0,
          C : [
            [
              '5299619240641551281634865583518297030282874472190772894086521144482721001553',
              '16950150798460657717958625567821834550301663161624707787222815936182638968203'
            ],
            [
              '5299619240641551281634865583518297030282874472190772894086521144482721001553',
              '16950150798460657717958625567821834550301663161624707787222815936182638968203'
            ]
          ]
      },
      FILE_WASM,
      FILE_ZKEY
  )

  console.log("prover publicSignals : ", publicSignals)
  exit(0)
  expect(await snarkjs.groth16.verify(
    vKey,
    [
        publicSignals[0],   // out
        publicSignals[1],
        publicSignals[2],   // f_l
        publicSignals[3],   // l
        publicSignals[4],   // C[t][2]
        publicSignals[5],
        publicSignals[6],
        publicSignals[7]
    ],
    proof
  )).eq(true)
  exit(0)
}


async function main(
) {
    // init
    // await zkp_test()
    await zkp_round2()
    const jub = await jub_test()
    const owners = await ethers.getSigners()
    let owner : SignerWithAddress = owners[0]

    // Parameters
    const V = [1, 2, 3, 4, 5]        // voting power per user
    const N_USER = V.length
    const COMMITEE = [owners[0], owners[1], owners[2]]
    const N_COM = COMMITEE.length
    const t = 2

    const verifiers = []
    const nc = await (new Nouns__factory(owner)).deploy(
        verifiers,
        COMMITEE.map((e) => e.address),
        t,
        V.reduce((a,b)=>a+b)
    )

    // 1. Key Generation Round 1 (Committee)
    let a = []  // [][]
    let C = []  // [][][2]
    const edwards_twist_C = []  // [][][2]
    let PK = [jub.F.e("0"), jub.F.e("1")]
    for (let i = 0; i < N_COM; i++) {
        a.push([])
        C.push([])
        edwards_twist_C.push([])
        for (let j = 0; j < t; j++) {
            //const r = Math.floor(Math.random() * 10000) // TODO: * jub.order)
            const r = 8
            const c = jub.mulPointEscalar(jub.Generator, r)
            a[i].push(r)
            C[i].push(c)
            edwards_twist_C[i].push([])
            edwards_twist_C[i][j].push(jub.F.toString(c[0]))
            edwards_twist_C[i][j].push(jub.F.toString(c[1]))
        }
        console.log("edwards_twist_C[i] : ", edwards_twist_C[i])
        expect(edwards_twist_C[i][0][0]).equal(jub.F.toString(jub.Base8[0]))
        
        // submit C on-chain.
        await (await nc.connect(COMMITEE[i]).round1(edwards_twist_C[i])).wait()
        
        PK = jub.addPoint(PK, C[i][0])
    }
    expect(jub.F.toString(PK[0])).equal(await nc.PK(0))

    // 2. Key Generation Round 2 (Committee)
    let f = []
    for (let i = 0; i < N_COM; i++) {
        f.push([])
        for (let l = 0; l < N_COM; l++) {
          f[i].push(polyval(a[i].reverse(), l))
        }
    }

    console.log("f : ", f)

    // TODO : Posideon Encrypt : why encrypt? when decrypt?
    // Now Using public on-chain ? instead of encrypt/decrypt
    // P xor P = 0 --> M = P xor P + M ?
    // ZKP for ... and (Posideon Encrypt)


    let sk = []
    for (let i = 0; i < N_COM; i++) {
        sk.push(0)
        for (let l = 0; l < N_COM; l++) {
            sk[i] += f[l][i]
        }
    }
    console.log("sk : ", sk)


    exit(0)



    // 3. User Voting
    let o = []
    let r = []        // random Fr per user
    let R = []
    let R_SUM = jub.Base8
    let M = []
    for (let i = 0; i < N_USER; i++) {
        r.push(Math.floor(Math.random() * 10000)) // TODO: * jub.order)
        R.push(jub.mulPointEscalar(jub.Generator, r))
        R_SUM = jub.addPoint(R_SUM, R[i])

        const m = jub.mulPointEscalar(PK, r[i])
        const vm = jub.addPoint(m, jub.mulPointEscalar(jub.Generator, V[i]))

        if (i % 3 == 0) {
          o.push(0b100)  // yes
          M.push([m, m, vm]);
        } else if (i % 3 == 1) {
          o.push(0b010)  // no
          M.push([m, vm, m]);
        } else {
          o.push(0b001)  // abstain
          M.push([m, m, vm]);
        }
    }

    // 4. Tally
    const D = []
    for (let i = 0; i < N_COM; i++) {
        D.push(jub.mulPointEscalar(R_SUM, sk[i]))
    }


    // 5. Reveal


    // Performance Profile
}


main()
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});