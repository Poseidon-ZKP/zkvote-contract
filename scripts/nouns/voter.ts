
import {
  PublicKey, groupOrder, pointFromScalar, pointMul, pointAdd
} from "../crypto";
import { generate_zkp_nvote } from "./prover";
import { hexlify } from "@ethersproject/bytes";
import { randomBytes } from "@ethersproject/random";
import { Signer, Contract } from "ethers";
import { expect } from "chai";


export enum Vote {
  Yay,
  Nay,
  Abstain,
}


export type PublicVoteData = {
  R: PublicKey[],
  M: PublicKey[],
};


function voteToO(v: Vote): bigint {
  switch(v) {
    case Vote.Yay: return 0b100n;
    case Vote.Nay: return 0b010n;
    case Vote.Abstain: return 0b001n;
    default: throw "unrecognized Vote";
  }
}


export class Voter {

  constructor(
    private babyjub: any,
    // private poseidon: any,
    public signer: Signer,
    private nc: Contract,
    private voting_weight: bigint) {
    this.nc = nc.connect(signer);
  }

  public async cast_vote(vote: Vote): Promise<PublicVoteData | null> {
    // Encrypt 3 votes.  One of which must be:
    //   voting_weight * G +

    const order = groupOrder(this.babyjub);
    const PK: PublicKey = (await this.nc.get_PK()).map((x: bigint) => x.toString());
    const o = voteToO(vote);

    const Rs: PublicKey[] = [];
    const Ms: PublicKey[] = [];
    const rs: bigint[] = [];

    const babyjub = this.babyjub;
    const vw = this.voting_weight;
    function encrypt_vote(v: Vote) {
      // r_i <- random
      // R_i = r_i*G
      // M_i = weight*o_i*G + r_i*PK (o_i = 1 if v == vote, else o_i = 0)
      const r = BigInt(hexlify(randomBytes(32))) % order
      const R = pointFromScalar(babyjub, r);
      let M = pointMul(babyjub, PK, r);  // r * PK
      if (v == vote) {
        const vG = pointFromScalar(babyjub, vw);
        M = pointAdd(babyjub, M, vG);
      }

      Rs.push(R);
      Ms.push(M);
      rs.push(r);
    }

    // Order must match the bit order
    encrypt_vote(Vote.Abstain); // 001
    encrypt_vote(Vote.Nay);     // 010
    encrypt_vote(Vote.Yay);     // 100

    const {proof /*, publicSignals */} = await generate_zkp_nvote(
      PK, this.voting_weight, Rs, Ms, o, rs);

    const address = await this.signer.getAddress();
    expect(await this.nc.has_voted(address)).to.be.false;
    await this.nc.vote(Rs, Ms, proof.a, proof.b, proof.c);
    expect(await this.nc.has_voted(address)).to.be.true;

    return { R: Rs, M: Ms };
  }

};
