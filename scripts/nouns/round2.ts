import { expect } from "chai";
import { exit } from "process";
import { poseidonDec, poseidonEnc } from "./poseidon";
import { generate_plonk_zkp_round2, generate_zkp_round2 } from "./prover";

export async function round2(
  COMMITEE,
  a,
  f,
  edwards_twist_C,
  r2r,
  nc,
  jub
) {
    const N_COM = COMMITEE.length
    for (let i = 0; i < N_COM; i++) {
      for (let l = 0; l < N_COM; l++) {
        if (i == l) continue;

        const {proof, publicSignals} = await generate_plonk_zkp_round2(
          f[i][l],
          l,
          edwards_twist_C[i],
          edwards_twist_C[l][0],
          r2r[i][l]
        )

        const {KB, enc} = await poseidonEnc(f[i][l], r2r[i][l], edwards_twist_C[l][0], jub)
        expect(BigInt(enc)).equal(BigInt(publicSignals.enc))
        expect(KB[0]).equal(publicSignals.kb[0])
        const {dec} = await poseidonDec(enc, a[l][0], KB, jub)
        expect(BigInt(dec)).equal(BigInt(f[i][l]))

        await (await nc.connect(COMMITEE[i]).round2(
          l, publicSignals.enc, publicSignals.kb, publicSignals.out, proof
        )).wait()
        console.log("round 2 on-chain verify done!!")
      }
    }

    // TODO : verify (recursive) aggregate plonk proof

    console.log("round 2 done!!")
}