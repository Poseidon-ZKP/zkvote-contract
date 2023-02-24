import { expect } from "chai";
import { BigNumberish } from "ethers";
import { exit } from "process";
import * as snarkjs from "snarkjs"

export type SolidityProof = [
  BigNumberish,
  BigNumberish,
  BigNumberish,
  BigNumberish,
  BigNumberish,
  BigNumberish,
  BigNumberish,
  BigNumberish
]


export default function packToSolidityProof(proof): SolidityProof {
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

async function zkp_test() {
  const DIR = process.cwd()
  const CUR_CIRCUIT = "nouns"
  const CIRCUIT_TGT_DIR = DIR + "/circuits/" + CUR_CIRCUIT + "/"
  const FILE_WASM = CIRCUIT_TGT_DIR + CUR_CIRCUIT + "_js/" + CUR_CIRCUIT + ".wasm"
  const FILE_ZKEY = CIRCUIT_TGT_DIR + "zkey.16"

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
          in : 8,
          p : [
            '995203441582195749578291179787384436505546430278305826713579947235728471134',
            '5472060717959818805561601436314318772137091100104008585924551046643952123905'
          ],
      },
      FILE_WASM,
      FILE_ZKEY
  )

  console.log("prover proof : ", proof)
  console.log("prover publicSignals : ", publicSignals)
  exit(0)
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

export async function generate_zkp_round2(
  f_l,
  l,
  C
) {
  const DIR = process.cwd()
  const CUR_CIRCUIT = "round2"
  const CIRCUIT_TGT_DIR = DIR + "/circuits/" + CUR_CIRCUIT + "/"
  const FILE_WASM = CIRCUIT_TGT_DIR + CUR_CIRCUIT + "_js/" + CUR_CIRCUIT + ".wasm"
  const FILE_ZKEY = CIRCUIT_TGT_DIR + "zkey.16"
  const vKey = await snarkjs.zKey.exportVerificationKey(FILE_ZKEY);

  // console.log("f_l : ", f_l)
  // console.log("l : ", l)
  // console.log("C : ", C)
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
          f_l : f_l,
          l : l,
          C : C
      },
      FILE_WASM,
      FILE_ZKEY
  )

  // console.log("prover proof : ", proof)
  // console.log("prover publicSignals : ", publicSignals)
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

  console.log("round2 prover done!")

  return {
    proof : packToSolidityProof(proof),
    publicSignals: {
      f_l : f_l,
      l : l,
      C : C,
      out : [publicSignals[0], publicSignals[1]]
    }
  }
}

export async function generate_zkp_nvote(
  pk,v,r,o
) {
  const DIR = process.cwd()
  const CUR_CIRCUIT = "nvote"
  const CIRCUIT_TGT_DIR = DIR + "/circuits/" + CUR_CIRCUIT + "/"
  const FILE_WASM = CIRCUIT_TGT_DIR + CUR_CIRCUIT + "_js/" + CUR_CIRCUIT + ".wasm"
  const FILE_ZKEY = CIRCUIT_TGT_DIR + "zkey.16"
  const vKey = await snarkjs.zKey.exportVerificationKey(FILE_ZKEY);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
          pk : pk,
          votePower : v,
          r : r,
          o : o
      },
      FILE_WASM,
      FILE_ZKEY
  )

  expect(await snarkjs.groth16.verify(
    vKey,
    [
        publicSignals[0],   // R
        publicSignals[1],
        publicSignals[2],   // M
        publicSignals[3],
        publicSignals[4],
        publicSignals[5],
        publicSignals[6],
        publicSignals[7],
        publicSignals[8],   // PK
        publicSignals[9],
        publicSignals[10]   // vote power
    ],
    proof
  )).eq(true)

  console.log("nvote prover done!")

  return {
    proof : packToSolidityProof(proof),
    publicSignals: {
      pk : pk,
      votePower : v,
      R : [publicSignals[0], publicSignals[1]],
      M : [
        [publicSignals[2], publicSignals[3]],
        [publicSignals[4], publicSignals[5]],
        [publicSignals[6], publicSignals[7]],
      ]
    }
  }
}