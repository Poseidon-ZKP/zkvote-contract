import { generate_zkp_round2 } from "./prover";

export async function round2(
  COMMITEE,
  f,
  edwards_twist_C,
  r2r,
  nc
) {
    const N_COM = COMMITEE.length
    for (let i = 0; i < N_COM; i++) {
      for (let l = 0; l < N_COM; l++) {
        if (i == l) continue;

        const {proof, publicSignals} = await generate_zkp_round2(
          f[i][l],
          l,
          edwards_twist_C[i],
          edwards_twist_C[l][0],
          r2r[i][l]
        )

        await (await nc.connect(COMMITEE[i]).round2(
          l, publicSignals.enc, publicSignals.kb, publicSignals.out, proof
        )).wait()
        console.log("round 2 on-chain verify done!!")
      }
    }
    console.log("round 2 done!!")
}