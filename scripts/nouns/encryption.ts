import { PublicKey, pointFromScalar, pointMul, groupOrder } from "../crypto";

import { randomBytes } from "@ethersproject/random";
import { hexlify } from "@ethersproject/bytes";
import { expect } from "chai";
const { buildPoseidonReference } = require('circomlibjs');
const { buildBabyjub } = require('circomlibjs');


export const BN_SCALAR_FIELD_MOD = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");


export type EncryptedWithEphSK = {
  eph_sk: bigint;
  eph_pk: PublicKey;
  enc: bigint;
}

export type Encrypted = {
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

  const eph_sk = BigInt(hexlify(randomBytes(32))) % groupOrder(babyjub);
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
