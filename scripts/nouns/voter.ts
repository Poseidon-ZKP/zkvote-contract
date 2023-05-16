
import {
  PublicKey, groupOrder, pointFromScalar, pointFromSolidity, pointMul, pointAdd
} from "../crypto";
import { Nouns, NounsContractDescriptor } from "./nouns_contract";
import * as nouns_contract from "./nouns_contract";
import * as dkg_contract from "./dkg_contract";
import { generate_zkp_nvote } from "./prover";
import { hexlify } from "@ethersproject/bytes";
import { randomBytes } from "@ethersproject/random";
import { Signer, BigNumberish } from "ethers";
import { expect } from "chai";
const { buildBabyjub } = require('circomlibjs');


export enum Vote {
  Yay,
  Nay,
  Abstain,
}


export type VoteRecord = {
  vote: Vote,
  R: PublicKey[],
  M: PublicKey[],
};


// Type of the R and M vectors submitted to the contract.
type SolidityEncryptedVotes = [
  [BigNumberish, BigNumberish],
  [BigNumberish, BigNumberish],
  [BigNumberish, BigNumberish]
];



/// Class exposing the Voter operations.  In the browser, Signer can be
/// constructed with code of the form:
///
///   const provider = new ethers.providers.Web3Provider(window.ethereum);
///   const signer = provider.getSigner();
export class Voter {

  babyjub: any;
  signer: Signer;
  nc: Nouns;

  private constructor(
    babyjub: any,
    signer: Signer,
    nouns_desc: NounsContractDescriptor) {
    this.babyjub = babyjub;
    this.signer = signer;
    this.nc = nouns_contract.from_descriptor(signer.provider, nouns_desc)
      .connect(signer);
  }

  public static async initialize(
    signer: Signer,
    nouns_desc: NounsContractDescriptor): Promise<Voter> {
    return new Voter(
      await buildBabyjub(),
      signer,
      nouns_desc);
  }

  public async get_voting_weight(): Promise<bigint> {
    // TODO: For now, we just keep this on locally on the class.  Later, query
    // the chain or some snapshot for this info.
    const weight = await this.nc.get_voting_weight(await this.signer.getAddress());
    return BigInt(weight.toString());
  }

  /// DUMMY register as a voter
  public async dummy_register(voting_weight: bigint): Promise<void> {
    await this.nc.add_voter(await this.signer.getAddress(), voting_weight);
  }

  /// Cast an (encrypted) vote in one direction, using the voting weight.  The
  /// returned structure is intended to be recorded by the caller, and should
  /// not be made public.
  public async cast_vote(vote: Vote): Promise<VoteRecord | null> {

    // Encrypt 3 votes.  One of which must be:
    //   voting_weight * G +

    const voting_weight = await this.get_voting_weight();

    const dc = await dkg_contract.from_address(this.signer, await this.nc.dkg());

    const order = groupOrder(this.babyjub);
    const PK: PublicKey = pointFromSolidity(await dc.get_PK());
    const o = Voter.voteToO(vote);

    const Rs: PublicKey[] = [];
    const Ms: PublicKey[] = [];
    const rs: bigint[] = [];

    const babyjub = this.babyjub;
    const vw = await this.get_voting_weight();
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
      PK, voting_weight, Rs, Ms, o, rs);

    const address = await this.signer.getAddress();
    expect(await this.nc.has_voted(address)).to.be.false;
    await this.nc.vote(
      <SolidityEncryptedVotes>Rs,
      <SolidityEncryptedVotes>Ms,
      proof.a,
      proof.b,
      proof.c);
    expect(await this.nc.has_voted(address)).to.be.true;

    return { vote, R: Rs, M: Ms };
  }

  static voteToO(v: Vote): bigint {
    switch(v) {
      case Vote.Yay: return 0b100n;
      case Vote.Nay: return 0b010n;
      case Vote.Abstain: return 0b001n;
      default: throw "unrecognized Vote";
    }
  }
};
