
import { PublicKey, pointFromScalar, polynomial_evaluate,
         polynomial_evaluate_group } from "../crypto";
import { Signer, Contract } from "ethers";
import { randomBytes } from "@ethersproject/random";
import { hexlify } from "@ethersproject/bytes";
import { expect } from "chai";
const polyval = require( 'compute-polynomial' );


type Round2SecretShare = {
  // l: number,
  f_i_l: bigint,
  f_i_l_commit: PublicKey,
};


export class CommitteeMemberRound1 {

  babyjub: any;
  signer: Signer;
  threshold: number;
  id: number;
  a_coeffs: bigint[];
  C_coeff_commitments: PublicKey[];

  constructor(
    babyjub: any,
    signer: Signer,
    threshold: number,
    id: number,
    a_coeffs: bigint[],
    C_coeff_commitments: PublicKey[]
  ) {
    this.babyjub = babyjub;
    this.signer = signer;
    this.threshold = threshold;
    this.id = id;
    this.a_coeffs = a_coeffs;
    this.C_coeff_commitments = C_coeff_commitments;

    console.log(
      "COMMITTEE MEMBER " + id + ": " +
        JSON.stringify(a_coeffs.map(x => x.toString())));
  }

  public static initialize(babyjub: any, signer: Signer, threshold: number, id: number): CommitteeMemberRound1 {
    let as: bigint[] = [];
    let Cs: PublicKey[] = [];

    for (let i = 0 ; i < threshold ; ++i) {
      const a = BigInt(id * 10 + i);
      as.push(a);
      Cs.push(pointFromScalar(babyjub, a));
    }

    return new CommitteeMemberRound1(babyjub, signer, threshold, id, as, Cs);
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
    // const babyjub = this.babyjub;
    // const B = babyjub.Base8;
    // const Cs = this.a_coeffs.map(a => { return babyjub.mulPointEscalar(B, a); });
    // // console.log("Cs: " + JSON.stringify(Cs));
    // // Convert to bigints
    // return Cs.map(
    //     c => c.map(
    //         c_i => babyjub.F.toString(c_i)
    //     )
    // );

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
      this.babyjub.subOrder);

    const babyjub = this.babyjub;
    const f_i_l_commit = pointFromScalar(babyjub, f_i_l);

    expect(f_i_l_commit).eql(polynomial_evaluate_group(
      this.babyjub, this.getCoefficientCommitments(), BigInt(recipient_id)));
    return {/*l,*/ f_i_l, f_i_l_commit};
  }

};
