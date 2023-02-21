const { buildBabyjub } = require('circomlibjs');
const polyval = require( 'compute-polynomial' );
import { expect } from "chai";
import { exit } from "process";
import * as snarkjs from "snarkjs"

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

async function main(
) {
    // await zkp_test()
    const jub = await jub_test()

    // Parameters
    const V = [1, 2, 3, 4, 5]        // voting power per user
    const N_USER = V.length
    const N_COM = 3
    const t = 2

    // 1. Key Generation Round 1 (Committee)
    let a = []  // [][]
    let C = []  // [][][2]
    for (let i = 0; i < N_COM; i++) {
        a.push([])
        C.push([])
        for (let j = 0; j < t; j++) {
            //const r = Math.floor(Math.random() * 10000) // TODO: * jub.order)
            const r = 8
            const c = jub.mulPointEscalar(jub.Generator, r)
            a[i].push(r)
            C[i].push(c)
        }
    }
    expect(jub.F.toString(C[0][0][0])).equal(jub.F.toString(jub.Base8[0]))
    exit(0)

    // submit C on-chain. 


    // 2. Key Generation Round 2 (Committee)
    let f = []
    for (let i = 0; i < N_COM; i++) {
        f.push([])

        for (let l = 0; l < N_COM; l++) {
          f[i].push(polyval(a[i].reverse(), l))
        }
    }

    let sk = []
    for (let i = 0; i < N_COM; i++) {
        sk.push(0)
        for (let l = 0; l < N_COM; l++) {
            sk[i] += f[l][i]
        }
    }

    let PK = jub.Base8  // TODO : ZERO Point
    for (let i = 0; i < N_COM; i++) {
        PK = jub.addPoint(PK, C[i][0])
    }


    // Posideon Encrypt : why encrypt? when decrypt?
    // P xor P = 0 --> M = P xor P + M ?
    
    // ZKP for ... and Posideon Encrypt


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