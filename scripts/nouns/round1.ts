import { expect } from "chai";

export async function round1(
  COMMITEE,
  t,
  jub,
  nc
) {
  let a = []  // [][]
  let C = []  // [][][2]
  const edwards_twist_C = []  // [][][2]
  let PK = [jub.F.e("0"), jub.F.e("1")]

    for (let i = 0; i < COMMITEE.length; i++) {
        a.push([])
        C.push([])
        edwards_twist_C.push([])
        for (let j = 0; j < t; j++) {
            const r = Math.floor(Math.random() * 10) // TODO: * jub.order)
            const c = jub.mulPointEscalar(jub.Generator, r)
            a[i].push(r)
            C[i].push(c)
            edwards_twist_C[i].push([])
            edwards_twist_C[i][j].push(jub.F.toString(c[0]))
            edwards_twist_C[i][j].push(jub.F.toString(c[1]))
        }
        
        // submit C on-chain.
        await (await nc.connect(COMMITEE[i]).round1(edwards_twist_C[i])).wait()
        
        PK = jub.addPoint(PK, C[i][0])
    }

    expect(jub.F.toString(PK[0])).equal(await nc.PK(0))
    console.log("round 1 done!")
    return {
      a : a,
      C : C,
      edwards_twist_C : edwards_twist_C,
      PK : PK
    }
}