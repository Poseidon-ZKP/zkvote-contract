
import { EncryptedWithEphSK, poseidonEncEx, poseidonDecEx } from "./poseidon";
import { PublicKey, groupOrder, pointFromScalar, polynomial_evaluate,
         polynomial_evaluate_group } from "../crypto";
import { Signer, Contract } from "ethers";
import { randomBytes } from "@ethersproject/random";
import { hexlify } from "@ethersproject/bytes";
import { expect } from "chai";


type Round2SecretShare = {
  // l: number,
  f_i_l: bigint,
  f_i_l_commit: PublicKey,
};


/// Committee member with secret key share, able to participate in vote
/// tallying.
export class CommitteeMember {
}


/// Committee member participating in Distributed Key Generation.
export class CommitteeMemberDKG {

  babyjub: any;
  poseidon: any;
  nc: Contract;
  signer: Signer;
  threshold: number;
  id: number;
  a_coeffs: bigint[];
  C_coeff_commitments: PublicKey[];

  constructor(
    babyjub: any,
    poseidon: any,
    nc: Contract,
    signer: Signer,
    threshold: number,
    id: number,
    a_coeffs: bigint[],
    C_coeff_commitments: PublicKey[]
  ) {
    this.babyjub = babyjub;
    this.poseidon = poseidon;
    this.nc = nc;
    this.signer = signer;
    this.threshold = threshold;
    this.id = id;
    this.a_coeffs = a_coeffs;
    this.C_coeff_commitments = C_coeff_commitments;

    console.log(
      "COMMITTEE MEMBER " + id + ": " +
        JSON.stringify(a_coeffs.map(x => x.toString())));
  }

  public static initialize(
    babyjub: any,
    poseidon: any,
    nc: Contract,
    signer: Signer,
    threshold: number,
    id: number
  ): CommitteeMemberDKG {
    let as: bigint[] = [];
    let Cs: PublicKey[] = [];

    for (let i = 0 ; i < threshold ; ++i) {
      const a = BigInt(hexlify(randomBytes(32))) % groupOrder(babyjub);
      as.push(a);
      Cs.push(pointFromScalar(babyjub, a));
    }

    return new CommitteeMemberDKG(
      babyjub, poseidon, nc.connect(signer), signer, threshold, id, as, Cs);
  }

  public toString(): string {
    return JSON.stringify({
      signer: this.signer,
      threshold: this.threshold,
      a_coeffs: this.a_coeffs.map(x => hexlify(x)),
      C_coeff_commitments: this.C_coeff_commitments,
    });
  }

  /// Return the commitments { C_{i,j} }.
  public getCoefficientCommitments(): string[][] {
    return this.C_coeff_commitments;
  }

  public getRound2PublicKey(): PublicKey {
    return this.C_coeff_commitments[0];
  }

  public getRound2SecretKey(): bigint {
    return this.a_coeffs[0];
  }

  public computeRound2ShareFor(recipient_id: number): Round2SecretShare {
    expect(recipient_id > 0);
    if (recipient_id <= 0) { throw "invalid recip_id: " + recipient_id; }
    const f_i_l = polynomial_evaluate(
      this.a_coeffs,
      BigInt(recipient_id),
      groupOrder(this.babyjub));

    const babyjub = this.babyjub;
    const f_i_l_commit = pointFromScalar(babyjub, f_i_l);

    const expect_f_i_l_commit = polynomial_evaluate_group(
      this.babyjub, this.getCoefficientCommitments(), BigInt(recipient_id));
    console.log("       f_i_l_commit: " + f_i_l_commit);
    console.log("expect_f_i_l_commit: " + expect_f_i_l_commit);
    expect(f_i_l_commit).eql(expect_f_i_l_commit);
    return {/*l,*/ f_i_l, f_i_l_commit};
  }

  public encryptRound2ShareFor(share: bigint, recip_PK: PublicKey): EncryptedWithEphSK {
    return poseidonEncEx(this.babyjub, this.poseidon, share, recip_PK);
  }

  public async round2Done(): Promise<boolean> {
    return await this.nc.round2_complete();
  }

  public decryptRound2Share(enc: bigint, eph_pk: PublicKey): bigint {
    return poseidonDecEx(
      this.babyjub, this.poseidon, {eph_pk, enc}, this.getRound2SecretKey())
  }

  public constructSecretShare(): CommitteeMember {
    return new CommitteeMember;
  }
};
