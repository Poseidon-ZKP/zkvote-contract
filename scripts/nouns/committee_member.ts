
import { EncryptedWithEphSK, poseidonEncEx, poseidonDecEx } from "./encryption";
import {
  PublicKey, groupOrder, pointFromScalar, pointFromSolidity, pointMul,
  polynomial_evaluate, polynomial_evaluate_group
} from "../crypto";
import { generate_zkp_round2, generate_zkp_tally } from "./prover";
import { Nouns } from "../types";
import { Signer, BigNumberish } from "ethers";
import { randomBytes } from "@ethersproject/random";
import { hexlify } from "@ethersproject/bytes";
import { Provider, Filter, Log } from "@ethersproject/providers";
import { expect } from "chai";


type Round2SecretShare = {
  f_i_l: bigint,
  PK_i_l: PublicKey,
};


type ParsedRound2Event = {
  recip_id: bigint;
  sender_id: bigint;
  enc_sk_share: bigint;
  enc_eph_pk: PublicKey;
};


/// Committee member with secret key share, able to participate in vote
/// tallying.
export class CommitteeMember {

  babyjub: any;
  poseidon: any;
  nc: Nouns;
  signer: Signer;
  n_comm: number;
  threshold: number;
  id: number;
  sk_i: bigint;
  PK_i: PublicKey;

  constructor(
    babyjub: any,
    poseidon: any,
    nc: Nouns,
    signer: Signer,
    n_comm: number,
    threshold: number,
    id: number,
    sk_i: bigint,
    PK_i: PublicKey) {
    this.babyjub = babyjub;
    this.poseidon = poseidon;
    this.nc = nc;
    this.signer = signer;
    this.n_comm = n_comm;
    this.threshold = threshold;
    this.id = id;
    this.sk_i = sk_i;
    this.PK_i = PK_i;
  }

  log(msg: string) {
    console.log("[C:" + this.id + "] " + msg);
  }

  public async tallyVotes(): Promise<void> {
    // Query R from the contract and compute D_{i,k}, k=1,2,3, where:
    //
    //  D_{i,k} = sk_i * R_{i,k}

    this.log("tally:");

    const R: PublicKey[] = (await this.nc.get_R()).map(pointFromSolidity);
    this.log("  R (from contract): " + JSON.stringify(R));

    const D_i = R.map(R_i => pointMul(this.babyjub, R_i, this.sk_i));
    this.log("  D_i (our contribution): " + JSON.stringify(D_i));

    // Create proof of computation.
    this.log("  proving contribution...");
    const { proof } = await generate_zkp_tally(this.PK_i, R, D_i, this.sk_i);

    // Send (id, D_{i,1}, D_{i,2}, D_{1,3}) to the contract, with a proof.

    await this.nc.tally(
      <any>D_i,
      proof.a,
      proof.b,
      proof.c);
  }
}


/// Committee member participating in Distributed Key Generation.
export class CommitteeMemberDKG {

  babyjub: any;
  poseidon: any;
  nc: Nouns;
  signer: Signer;
  n_comm: number;
  threshold: number;
  id: number;
  a_coeffs: bigint[];
  C_coeff_commitments: PublicKey[];

  constructor(
    babyjub: any,
    poseidon: any,
    nc: Nouns,
    signer: Signer,
    n_comm: number,
    threshold: number,
    id: number,
    a_coeffs: bigint[],
    C_coeff_commitments: PublicKey[]
  ) {
    this.babyjub = babyjub;
    this.poseidon = poseidon;
    this.nc = nc.connect(signer);
    this.signer = signer;
    this.n_comm = n_comm;
    this.threshold = threshold;
    this.id = id;
    this.a_coeffs = a_coeffs;
    this.C_coeff_commitments = C_coeff_commitments;

    this.log(JSON.stringify(a_coeffs.map(x => x.toString())));
  }

  public static initialize(
    babyjub: any,
    poseidon: any,
    nc: Nouns,
    signer: Signer,
    n_comm: number,
    threshold: number,
    id: number
  ): CommitteeMemberDKG {
    expect(n_comm).to.be.greaterThanOrEqual(threshold);

    let as: bigint[] = [];
    let Cs: PublicKey[] = [];

    for (let i = 0 ; i < threshold ; ++i) {
      const a = BigInt(hexlify(randomBytes(32))) % groupOrder(babyjub);
      as.push(a);
      Cs.push(pointFromScalar(babyjub, a));
    }

    return new CommitteeMemberDKG(
      babyjub, poseidon, nc.connect(signer), signer, n_comm, threshold, id, as, Cs);
  }

  public toString(): string {
    return JSON.stringify({
      signer: this.signer,
      threshold: this.threshold,
      a_coeffs: this.a_coeffs.map(x => hexlify(x)),
      C_coeff_commitments: this.C_coeff_commitments,
    });
  }

  log(msg: string) {
    console.log("[C:" + this.id + "] " + msg);
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

  public async round1(): Promise<void> {
    // Post commitments to our polynomial coefficients to the contract.

    this.log("posting Cs: " + JSON.stringify(this.C_coeff_commitments));
    await this.nc.round1(<[BigNumberish, BigNumberish][]>(this.C_coeff_commitments));
  }

  public async round1_wait(): Promise<void> {
    // wait for all other participants to finish posting their coefficient commitments.
    while (!(await this.nc.round1_complete())) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  public computeRound2ShareFor(recipient_id: number): Round2SecretShare {
    expect(recipient_id > 0);
    if (recipient_id <= 0) { throw "invalid recip_id: " + recipient_id; }
    const f_i_l = polynomial_evaluate(
      this.a_coeffs,
      BigInt(recipient_id),
      groupOrder(this.babyjub));

    const babyjub = this.babyjub;
    const PK_i_l = pointFromScalar(babyjub, f_i_l);

    const expect_f_i_l_commit = polynomial_evaluate_group(
      this.babyjub, this.getCoefficientCommitments(), BigInt(recipient_id));
    expect(PK_i_l).eql(expect_f_i_l_commit);
    return {f_i_l, PK_i_l};
  }

  public encryptRound2ShareFor(share: bigint, recip_PK: PublicKey): EncryptedWithEphSK {
    return poseidonEncEx(this.babyjub, this.poseidon, share, recip_PK);
  }

  public async round2(committee_ids: number[]): Promise<void> {
    // For each recipient (including us), compute and encrypt the share of OUR
    // secret.

    // TODO(duncan): get committee member ID list from the contract

    const our_id = this.id;
    const that = this;

    await Promise.all(committee_ids.map(async recip_id => {

      const recip_PK = pointFromSolidity(
        await this.nc.get_round1_PK_for(recip_id));

      this.log("round2: computing share for " + JSON.stringify({
        id: recip_id, pk: recip_PK}));

      const {f_i_l, PK_i_l} = this.computeRound2ShareFor(recip_id);
      this.log("       PK_i_l: " + PK_i_l);

      const {eph_sk, eph_pk, enc} = this.encryptRound2ShareFor(f_i_l, recip_PK);

      // Generate the proof of encryption
      const {proof} = await generate_zkp_round2(
        recip_id,
        recip_PK,
        that.C_coeff_commitments,
        f_i_l,
        PK_i_l,
        eph_sk,
        enc,
        eph_pk,
      )

      // Post the share to the contract
      expect(await that.nc.round2_share_received(our_id, recip_id)).to.be.false;
      await that.nc.round2(
        recip_id,
        enc,
        <[BigNumberish, BigNumberish]>eph_pk,
        <[BigNumberish, BigNumberish]>PK_i_l,
        proof.a,
        proof.b,
        proof.c,
      )
    }));
  }

  public async round2_wait(): Promise<void> {
    while (!(await this.nc.round2_complete())) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  public decryptRound2Share(enc: bigint, eph_pk: PublicKey): bigint {
    return poseidonDecEx(
      this.babyjub, this.poseidon, {eph_pk, enc}, this.getRound2SecretKey())
  }

  public async constructSecretShare(): Promise<CommitteeMember> | null {

    const provider: Provider = this.signer.provider;

    //
    const cur_block: number = await provider.getBlockNumber();

    // We want to pull all events:
    //
    //   event Round2Share(
    //     uint indexed recip_id, uint sender_id, uint enc_sk_share, uint[2] enc_eph_PK);
    //
    // where recip_id is equal to our id.

    this.log("reading shares:");

    // TODO: Pull in batches.

    const filter: Filter = this.nc.filters.Round2Share(this.id);
    filter.fromBlock = 0;
    filter.toBlock = cur_block;
    const logs = await provider.getLogs(filter);
    expect(logs.length).to.equal(this.n_comm);

    // Parse
    const intfc = this.nc.interface;
    const that = this;
    function parseLog(log: Log): ParsedRound2Event {
      const parsed = intfc.parseLog(log);
      const args = parsed.args
      // console.log("  parsed args: " + JSON.stringify(args));
      const event: ParsedRound2Event = {
        recip_id: BigInt(args[0]),
        sender_id: BigInt(args[1]),
        enc_sk_share: BigInt(args[2]),
        enc_eph_pk: [
          args[3][0].toString(),
          args[3][1].toString()],
      };
      that.log("    event: " + JSON.stringify({
        recip_id: event.recip_id.toString(),
        sender_id: event.sender_id.toString(),
        enc_sk_share: event.enc_sk_share.toString(),
        enc_eph_pk: event.enc_eph_pk,
      }));

      return event;
    };
    const parsedEvents: ParsedRound2Event[] = logs.map(parseLog);

    // Decrypt and sum event values to compute our share of the final secret.
    let sk_i = 0n;

    const order = groupOrder(this.babyjub);
    parsedEvents.forEach(ev => {
      const dec = this.decryptRound2Share(ev.enc_sk_share, ev.enc_eph_pk);
      this.log("    decrypted (from " + ev.sender_id + ") = " + dec.toString());
      sk_i = (sk_i + dec) % order;
    });

    // PK = f_i * G
    const PK_i = pointFromScalar(this.babyjub, sk_i);

    this.log("  sk_i: " + sk_i.toString());
    this.log("  PK_i: " + PK_i);

    // Check that PK matches the eval of the (encoded) polynomial, given the
    // coefficient sums.
    {
      const PK_coeffs_sol = (await this.nc.PK_coefficients());
      const PK_coeffs = PK_coeffs_sol.map(pointFromSolidity);
      const PK_i_expect = polynomial_evaluate_group(
        this.babyjub, PK_coeffs, BigInt(this.id));
      expect(PK_i).to.eql(PK_i_expect);
    };

    // Check that PK matches the sum of all public secret shares.
    {
      const pk_i = pointFromSolidity(await this.nc.get_PK_for(this.id));
      expect(pk_i).to.eql(PK_i);
    }

    // TODO(duncan): in principle, a CommitteeMember could initialize itself
    // given only its id and the round2 secret key a_coeff[0], entirely from
    // the chain.

    return new CommitteeMember(
      this.babyjub,
      this.poseidon,
      this.nc,
      this.signer,
      this.n_comm,
      this.threshold,
      this.id,
      sk_i,
      PK_i);
  }

};
