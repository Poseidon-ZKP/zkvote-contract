import { expect } from "chai";
import { exit } from "process";

const { buildPoseidonOpt, buildPoseidon, buildPoseidonReference} = require('circomlibjs');
const { buildBabyjub } = require('circomlibjs');

export async function poseidonEnc(
    msg, rB,  KA, jub
) {
    const rG = jub.mulPointEscalar(jub.Generator, rB)
    const KB = [jub.F.toString(rG[0]), jub.F.toString(rG[1])]
    
    const rKA = jub.mulPointEscalar([jub.F.e(KA[0]), jub.F.e(KA[1])], rB)
    const KS = [jub.F.toString(rKA[0]), jub.F.toString(rKA[1])]

    const posRef = await buildPoseidonReference();
    const enc = BigInt(posRef.F.toString(await posRef([KS[0]]))) + BigInt(msg)

    return {
      KB : KB,
      enc : enc
    }
}

export async function poseidonDec(
  EncMsg, rA, KB, jub
) {
    const rKB = jub.mulPointEscalar([jub.F.e(KB[0]), jub.F.e(KB[1])], rA)
    const KS = [jub.F.toString(rKB[0]), jub.F.toString(rKB[1])]

    const posRef = await buildPoseidonReference();
    const dec = BigInt(EncMsg) - BigInt(posRef.F.toString(await posRef([KS[0]])))

    return {
      dec : dec
    }
}

async function sanity() {
    const jub = await buildBabyjub()
    // const msgs = [1, 2, 3, 4]
    // msgs.map((a, i) => { console.log("a : ", a, ", i : ", i)})
    // console.log("reduce : ", msgs.reduce((acc, a, i) => acc + a))

    const msg = 16
    const rA = 8 // Math.floor(Math.random() * 10000)
    const rB = 1 // Math.floor(Math.random() * 10000)
    const rAG = jub.mulPointEscalar(jub.Generator, rA)
    const KA = [jub.F.toString(rAG[0]), jub.F.toString(rAG[1])]

    const {KB, enc} = await poseidonEnc(msg, rB, KA, jub)
    const {dec} = await poseidonDec(enc, rA, KB, jub)
    expect(BigInt(dec)).equal(BigInt(msg))
}

// sanity()
// .then(() => process.exit(0))
// .catch(error => {
//   console.error(error);
//   process.exit(1);
// });

