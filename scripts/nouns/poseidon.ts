import { PublicKey, pointFromScalar, pointMul } from "../crypto";

import { randomBytes } from "@ethersproject/random";
import { hexlify } from "@ethersproject/bytes";
import { expect } from "chai";
const { buildPoseidonReference} = require('circomlibjs');
const { buildBabyjub } = require('circomlibjs');


export const BN_SCALAR_FIELD_MOD = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");


type EncryptedWithEphSK = {
    eph_sk: bigint;
    eph_pk: PublicKey;
    enc: bigint;
}

type Encrypted = {
    eph_pk: PublicKey;
    enc: bigint;
}


export function encryptedToString(enc: Encrypted): string {
    return JSON.stringify({
        eph_pk: enc.eph_pk,
        enc: enc.enc.toString(),
    });
}


export function poseidonEncEx(
    babyjub: any, poseidon: any, msg: bigint, KA: PublicKey
): EncryptedWithEphSK {
    // TODO: Use Generator?  Or Base8?

    const F = babyjub.F;

    // const eph_sk = BigInt(hexlify(randomBytes(32))) % babyjub.order;
    const eph_sk = BigInt(3);
    const eph_pk = pointFromScalar(babyjub, eph_sk);
    const KS = pointMul(babyjub, KA, eph_sk);
    const KS_0 = F.e(KS[0]);
    const hash_KS_0 = F.toObject(poseidon([KS_0]));
    const enc = (msg + hash_KS_0) % BN_SCALAR_FIELD_MOD;

    return { eph_sk, eph_pk, enc };
}

export function poseidonDecEx(
    babyjub: any, poseidon: any, enc: Encrypted, sk: bigint
): bigint {
    const F = babyjub.F;
    const KS = pointMul(babyjub, enc.eph_pk, sk);
    const KS_0 = F.e(KS[0]);
    const hash_KS_0 = F.toObject(poseidon([KS_0]));
    const dec = (enc.enc - hash_KS_0) % BN_SCALAR_FIELD_MOD;
    if (dec < 0) {
        return dec + BN_SCALAR_FIELD_MOD;
    }

    return dec;
}


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
