import { EncryptedWithEphSK, poseidonEncEx, poseidonDecEx } from "./encryption";
import {
  PublicKey, groupOrder, pointFromScalar, pointFromSolidity, pointMul,
  polynomial_evaluate, polynomial_evaluate_group
} from "../crypto";
import { deriveSecret } from "./key_derivation";
import { generate_zkp_round2, generate_zkp_tally } from "./prover";
import { ZKVoteContractDescriptor } from "./zkvote_contract";
import * as zkvote_contract from "./zkvote_contract";
import * as dkg_contract from "./dkg_contract";
import { ZKVote, DKG } from "../types";
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
  dc: DKG;
  zkv: ZKVote;
  signer: Signer;
  n_comm: number;
  threshold: number;
  id: number;
  sk_i: bigint;
  PK_i: PublicKey;

  constructor(
    babyjub: any,
    poseidon: any,
    dc: DKG,
    zkv: ZKVote,
    signer: Signer,
    n_comm: number,
    threshold: number,
    id: number,
    sk_i: bigint,
    PK_i: PublicKey) {
    this.babyjub = babyjub;
    this.poseidon = poseidon;
    this.dc = dc.connect(signer);
    this.zkv = zkv.connect(signer);
    this.signer = signer;
    this.n_comm = n_comm;
    this.threshold = threshold;
    this.id = id;
    this.sk_i = sk_i;
    this.PK_i = PK_i;
  }

  public async tallyVotes(proposalId: number): Promise<void> {
    // Query R from the contract and compute D_{i,k}, k=1,2,3, where:
    //
    //  D_{i,k} = sk_i * R_{i,k}

    this.log("tally:");

    const R: PublicKey[] = (await this.zkv.get_R(proposalId)).map(pointFromSolidity);
    this.log("  R (from contract): " + JSON.stringify(R));

    const D_i = R.map(R_i => pointMul(this.babyjub, R_i, this.sk_i));
    this.log("  D_i (our contribution): " + JSON.stringify(D_i));

    // Create proof of computation.
    this.log("  proving contribution...");
    const { proof } = await generate_zkp_tally(this.PK_i, R, D_i, this.sk_i);

    // Send (id, D_{i,1}, D_{i,2}, D_{1,3}) to the contract, with a proof.

    const that = this;
    async function send_tally(retry: number = 10): Promise<void> {
      try {
        console.log("sending tally tx ...");
        const tx = await that.zkv.tally(
          proposalId,
          <any>D_i,
          proof.a,
          proof.b,
          proof.c);

        await tx.wait();
      } catch (e) {
        console.log("retry: " + retry + "error: " + e)
        if (retry <= 0) {
          throw e;
        }

        console.log("retrying tally tx ...");
        await new Promise(r => setTimeout(r, 100));
        await send_tally(retry - 1);
      }
    }

    await send_tally();
  }

  log(msg: string) {
    console.log("[C:" + this.id + "] " + msg);
  }
}


/// Deterministically derive the a_0 secret using an Ethereum secret key.
export async function deriveDKGSecret(
  babyjub: any,
  signer: Signer
): Promise<bigint> {
  const { secret } = await deriveSecret(
    "zkVote Committee Member DKG secret",
    signer,
    groupOrder(babyjub));
  return secret;
}


/// Read the on-chain
export async function recoverCommitteeMember(
  babyjub: any,
  poseidon: any,
  dkg: DKG,
  zkv: ZKVote,
  signer: Signer,
  a_0: bigint
): Promise<CommitteeMember | null> {

  const provider: Provider = signer.provider;
  const address: string = await signer.getAddress();
  const n_comm: number = (await dkg.n_comm()).toNumber();
  const threshold: number = (await dkg.threshold()).toNumber();

  const cur_block: number = await provider.getBlockNumber();

  console.log("Recovering committee member.  addr=" + address + ", n_comm=" + n_comm);

  // Get my ID.
  const my_id = (await dkg.get_committee_id_from_address(address)).toNumber();
  if (my_id == 0) {
    console.log("  unknown address.");
    return null;
  }

  // We want to pull all Round2Share events which recip_id == my_id:
  //
  //   event Round2Share(
  //     uint indexed recip_id, uint sender_id, uint enc_sk_share, uint[2] enc_eph_PK);

  // TODO: Pull in batches.

  const filter: Filter = dkg.filters.Round2Share(my_id);
  filter.fromBlock = 0;
  filter.toBlock = cur_block;
  const logs = await provider.getLogs(filter);
  if (logs.length != n_comm) {
    console.log(" insufficient shares to reconstruct committee key");
    return null;
  }

  // Parse
  const intfc = dkg.interface;
  function parseLog(log: Log): ParsedRound2Event {
    const parsed = intfc.parseLog(log);
    const args = parsed.args
    const event: ParsedRound2Event = {
      recip_id: BigInt(args[0]),
      sender_id: BigInt(args[1]),
      enc_sk_share: BigInt(args[2]),
      enc_eph_pk: [
        args[3][0].toString(),
        args[3][1].toString()],
    };
    console.log("  event: " + JSON.stringify({
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

  const order = groupOrder(babyjub);
  parsedEvents.forEach(ev => {
    const encrypted = { eph_pk: ev.enc_eph_pk, enc: ev.enc_sk_share };
    const dec = poseidonDecEx(babyjub, poseidon, encrypted, a_0);
    console.log("!!  decrypted (from " + ev.sender_id + ") = " + dec.toString());
    sk_i = (sk_i + dec) % order;
  });

  // PK = f_i * G
  const PK_i = pointFromScalar(babyjub, sk_i);

  console.log("!!sk_i: " + sk_i.toString());
  console.log("  PK_i: " + PK_i);

  // Check that PK matches the eval of the (encoded) polynomial, given the
  // coefficient sums.
  {
    const PK_coeffs_sol = await dkg.PK_coefficients();
    const PK_coeffs = PK_coeffs_sol.map(pointFromSolidity);
    const PK_i_expect = polynomial_evaluate_group(babyjub, PK_coeffs, BigInt(my_id));
    expect(PK_i).to.eql(PK_i_expect, "secret shares don't match polynomial eval");
  };

  // Check that PK matches the sum of all public secret shares.
  {
    const pk_i = pointFromSolidity(await dkg.get_PK_for(my_id));
    expect(pk_i).to.eql(PK_i);
  }

  return new CommitteeMember(
    babyjub,
    poseidon,
    dkg,
    zkv,
    signer,
    n_comm,
    threshold,
    my_id,
    sk_i,
    PK_i);
}


/// Committee member participating in Distributed Key Generation.
export class CommitteeMemberDKG {

  babyjub: any;
  poseidon: any;
  dc: DKG;
  zkv: ZKVote;
  signer: Signer;
  n_comm: number;
  threshold: number;
  id: number;
  a_coeffs: bigint[];
  C_coeff_commitments: PublicKey[];

  private constructor(
    babyjub: any,
    poseidon: any,
    dc: DKG,
    zkv: ZKVote,
    signer: Signer,
    n_comm: number,
    threshold: number,
    id: number,
    a_coeffs: bigint[],
    C_coeff_commitments: PublicKey[]
  ) {
    this.babyjub = babyjub;
    this.poseidon = poseidon;
    this.dc = dc.connect(signer);
    this.zkv = zkv.connect(signer);
    this.signer = signer;
    this.n_comm = n_comm;
    this.threshold = threshold;
    this.id = id;
    this.a_coeffs = a_coeffs;
    this.C_coeff_commitments = C_coeff_commitments;

    this.log(JSON.stringify(a_coeffs.map(x => x.toString())));
  }

  public static async initialize(
    babyjub: any,
    poseidon: any,
    dc_descriptor: dkg_contract.DKGContractDescriptor,
    zkv_descriptor: ZKVoteContractDescriptor,
    signer: Signer,
    id: number,
    a_0: bigint
  ): Promise<CommitteeMemberDKG> {
    expect(dc_descriptor.n_comm).to.be.greaterThanOrEqual(dc_descriptor.threshold);


    let as: bigint[] = [a_0];
    let Cs: PublicKey[] = [pointFromScalar(babyjub, a_0)];

    for (let i = 1; i < dc_descriptor.threshold; ++i) {
      const a = BigInt(hexlify(randomBytes(32))) % groupOrder(babyjub);
      as.push(a);
      Cs.push(pointFromScalar(babyjub, a));
    }
    expect(as.length).to.equal(dc_descriptor.threshold);

    const dc = dkg_contract.from_descriptor(signer.provider, dc_descriptor);
    const zkv = zkvote_contract.from_descriptor(signer.provider, zkv_descriptor);

    return new CommitteeMemberDKG(
      babyjub,
      poseidon,
      dc.connect(signer),
      zkv.connect(signer),
      signer,
      dc_descriptor.n_comm,
      dc_descriptor.threshold,
      id,
      as,
      Cs);
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

  public async round1(retry: number = 10): Promise<void> {
    // Post commitments to our polynomial coefficients to the contract.

    this.log("posting Cs: " + JSON.stringify(this.C_coeff_commitments));
    try {
      const tx = await this.dc.round1(<[BigNumberish, BigNumberish][]>(this.C_coeff_commitments));
      await tx.wait();
    } catch (e) {
      if (retry <= 0) {
        throw e;
      }

      // TODO(duncan): this retrying is a bit of a hack, but is a conveninent
      // way to deal with the state changing between gas estimation and the tx
      // being deployed.  (e.g. if we are not last to submit when gas is
      // estimated, but last to submit when the tx is executed and therefore
      // end up doing more work).

      console.log("retrying round1() ...");
      await new Promise(r => setTimeout(r, 100));
      await this.round1(retry - 1);
    }
  }

  public async round1_wait(): Promise<void> {
    // wait for all other participants to finish posting their coefficient commitments.
    while (!(await this.dc.round1_complete())) {
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
    return { f_i_l, PK_i_l };
  }

  public encryptRound2ShareFor(share: bigint, recip_PK: PublicKey): EncryptedWithEphSK {
    return poseidonEncEx(this.babyjub, this.poseidon, share, recip_PK);
  }

  public async round2(): Promise<void> {
    // For each recipient (including us), compute and encrypt the share of OUR
    // secret.

    // TODO(duncan): get committee member ID list from the contract

    const our_id = this.id;
    const that = this;

    await Promise.all(Array.from({ length: this.n_comm }).map(async (_, idx) => {
      const recip_id = idx + 1;

      const recip_PK = pointFromSolidity(
        await this.dc.get_round1_PK_for(recip_id));

      this.log("round2: computing share for " + JSON.stringify({
        id: recip_id, pk: recip_PK
      }));

      const { f_i_l, PK_i_l } = this.computeRound2ShareFor(recip_id);
      this.log("       PK_i_l: " + PK_i_l);

      const { eph_sk, eph_pk, enc } = this.encryptRound2ShareFor(f_i_l, recip_PK);

      // Generate the proof of encryption
      const { proof } = await generate_zkp_round2(
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
      expect(await that.dc.round2_share_received(our_id, recip_id)).to.be.false;

      async function send_secret(retry: number = 10): Promise<void> {
        try {
          const tx = await that.dc.round2(
            recip_id,
            enc,
            <[BigNumberish, BigNumberish]>eph_pk,
            <[BigNumberish, BigNumberish]>PK_i_l,
            proof.a,
            proof.b,
            proof.c,
          );
          await tx.wait();
        } catch (e) {
          if (retry <= 0) {
            throw e;
          }

          console.log("retrying round2 tx ...");
          await new Promise(r => setTimeout(r, 100));
          await send_secret(retry - 1);
        }
      }

      await send_secret();
    }
    ));
  }

  public async round2_wait(): Promise<void> {
    while (!(await this.dc.round2_complete())) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  public async constructSecretShare(): Promise<CommitteeMember> {
    const member = await recoverCommitteeMember(
      this.babyjub,
      this.poseidon,
      this.dc,
      this.zkv,
      this.signer,
      this.getRound2SecretKey());
    expect(member).not.null;
    return member;
  }
};
