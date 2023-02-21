import { expect } from "chai";
import { exit } from "process";
import * as snarkjs from "snarkjs"

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

export async function generate_round2_zkp(
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

  return {proof, publicSignals}
}