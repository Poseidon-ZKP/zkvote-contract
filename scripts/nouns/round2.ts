const polyval = require( 'compute-polynomial' );
import { generate_zkp_round2 } from "./prover";

export async function round2(
  COMMITEE,
  a,
  edwards_twist_C,
  nc
) {
    const N_COM = COMMITEE.length

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
    for (let i = 0; i < N_COM; i++) {
      for (let l = 0; l < N_COM; l++) {
        if (i == l) continue;

        console.log(" i : ", i, ", l : ", l)
        const {proof, publicSignals} = await generate_zkp_round2(
          f[i][l],
          l,
          edwards_twist_C[i]
        )

        await (await nc.connect(COMMITEE[i]).round2(
          f[i][l], l, [publicSignals.out[0], publicSignals.out[1]], proof
        )).wait()
        console.log("round 2 on-chain verify done!!")
      }
    }
    console.log("round 2 done!!")

    let sk = []
    for (let i = 0; i < N_COM; i++) {
        sk.push(0)
        for (let l = 0; l < N_COM; l++) {
            sk[i] += f[l][i]
        }
    }
    console.log("sk : ", sk)
    return sk
}