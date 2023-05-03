import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { PublicKey, pointFromSolidity, pointFromScalar, pointAdd, pointMul } from "../crypto";
import {
    Nouns__factory, Round2Verifier__factory, NvoteVerifier__factory, TallyVerifier__factory,
} from "../types";
import { round1 } from "./round1";
import { round2 } from "./round2";
import { Vote, Voter, VoteRecord } from "./voter";
const { buildBabyjub, buildPoseidonReference } = require('circomlibjs');


async function main(
) {
  // init
  const jub = await buildBabyjub()
  const poseidon = await buildPoseidonReference();
  const owners = await ethers.getSigners()
  let deployer : SignerWithAddress = owners[0]

  // const accounts: any = hre.config.networks.hardhat.accounts;
  // for (let index = 0; index < owners.length; index++) {
  //   const wallet = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${index}`);
  //   console.log("`", wallet.privateKey + "`,")
  // }

  // Parameters
  // voting power per user
  const V = [1n, 2n, 3n, 4n]
  const N_USER = V.length
  const N_COM = 3
  expect(owners.length).to.be.greaterThanOrEqual(N_USER + N_COM);

  const t = 2
  let COMMITEE: SignerWithAddress[] = [];
  for (let i = 0; i < N_COM; i++) {
    COMMITEE.push(owners[i])
  }

  let USERS: SignerWithAddress[] = [];
  for (let i = 0 ; i < N_USER ; i++) {
    USERS.push(owners[N_COM + i]);
  }

  // const r2v = await (new Round2PlonkVerifier__factory(deployer)).deploy()
  const round2_verifier = await (new Round2Verifier__factory(deployer)).deploy()
  console.log("round2_verifier: " + round2_verifier.address);
  const nvote_verifier = await (new NvoteVerifier__factory(deployer)).deploy()
  console.log("nvote_verifier: " + nvote_verifier.address);
  const tally_verifier = await (new TallyVerifier__factory(deployer)).deploy()
  console.log("tally_verifier: " + tally_verifier.address);
  const verifiers = [
    round2_verifier.address,
    nvote_verifier.address,
    tally_verifier.address,
  ];
  const nc = await (new Nouns__factory(deployer)).deploy(
    verifiers,
    COMMITEE.map((e) => e.address),
    USERS.map((e) => e.address),
    V,
    t
  );

  // 1. Key Generation Round 1 (Committee)
  console.log("\n\n---- DKG ROUND1 ----");

  // const {a, C, edwards_twist_C, PK} = await round1(jub, COMMITEE, t, nc)
  // console.log("PK : ", [jub.F.toString(PK[0]), jub.F.toString(PK[1])])
  const round1_result = await round1(jub, poseidon, COMMITEE, t, nc);
  const round1_members = round1_result.members;
  console.log("round1_members: " + round1_members.map(x => x.toString()));

  // 2. Key Generation Round 2 (Committee)
  console.log("\n\n---- DKG ROUND2 ----");
  const round2_result = await round2(nc, round1_result);
  const full_members = round2_result.members;
  console.log("full_members: " + full_members.map(x => x.toString()));

  // 3. User Voting
  console.log("\n\n---- VOTE ----");
  const voters: Voter[] = USERS.map((signer, i) => {
    return new Voter(jub/*,poseidon */, signer, nc, V[i]);
  });

  const votes: Vote[] = [Vote.Abstain, Vote.Nay, Vote.Yay];
  const expect_vote_totals = [0n, 0n, 0n];
  // const vote_records: VoteRecord[] = await Promise.all(voters.map(async (voter, i) => {
  //   const my_vote = votes[i % votes.length];
  //   const public_vote = await voter.cast_vote(my_vote);

  //   console.log("Voter " + (await voter.signer.getAddress()) + ": " + JSON.stringify(public_vote));
  //   return public_vote;
  // }));
  const vote_records: VoteRecord[] = [];
  for (let i = 0 ; i < voters.length; ++i) {
    const voter = voters[i];
    const my_vote = votes[i % votes.length];
    const public_vote = await voter.cast_vote(my_vote);

    console.log("Voter " + (await voter.signer.getAddress()) + ": " + JSON.stringify(public_vote));
    const Ms = (await nc.get_M()).map(pointFromSolidity);
    const Rs = (await nc.get_R()).map(pointFromSolidity);
    console.log("M[0]: " + Ms[0]);
    console.log("R[0]: " + Rs[0]);

    vote_records.push(public_vote);

    // DEBUG: count the total votes we should see for each outcome:
    expect_vote_totals[i % votes.length] += voter.voting_weight;
  }

  // Sanity check contract state
  {
    const Ms = (await nc.get_M()).map(pointFromSolidity);
    const Rs = (await nc.get_R()).map(pointFromSolidity);

    let expectM0 = pointFromScalar(jub, 0n);
    let expectR0 = pointFromScalar(jub, 0n);
    vote_records.forEach(vr => {
      expectM0 = pointAdd(jub, expectM0, vr.M[0]);
      expectR0 = pointAdd(jub, expectR0, vr.R[0]);
    });

    console.log("M[0]: " + Ms[0]);
    console.log("expectM0: " + expectM0);
    console.log("R[0]: " + Rs[0]);
    console.log("expectR0: " + expectR0);

    expect(Ms[0]).to.eql(expectM0);
    expect(Rs[0]).to.eql(expectR0);
  }

  // 4. Vote Tally, using the first t committee members

  console.log("\n\n---- TALLY ----");
  if (1) {
    await Promise.all(full_members.slice(0, t).map(member => {
      return member.tallyVotes();
    }));
  } else {
    // For testing, deterministic vote order and check the tally data on the
    // contract.

    await full_members[0].tallyVotes();
    await full_members[1].tallyVotes();

    {
      const [cids, lambdas, DIs] = await nc.get_tally_committee_debug();
      const R: PublicKey[] = (await nc.get_R()).map(pointFromSolidity);
      const M: PublicKey[] = (await nc.get_M()).map(pointFromSolidity);
      console.log("cids: " + cids);
      console.log("lambdas: " + lambdas);
      console.log("DIs: " + DIs);
      console.log("R[0]: " + R[0]);
      console.log("M[0]: " + M[0]);

      // Attempt to decrypt M[0] using R[0] and the DIs[i][0]s.

      expect(cids.length).to.equal(2);
      expect(lambdas.length).to.equal(2);
      expect(DIs.length).to.equal(2);
      expect(cids).to.eql([BigNumber.from(1),BigNumber.from(2)]);

      const lambda_1 = BigInt(lambdas[0].toString());
      const DI_1_0 = pointFromSolidity(DIs[0][0]);
      const lambda_1_DI_1_0 = pointMul(jub, DI_1_0, lambda_1);
      console.log("lambda_1_DI_1_0: " + lambda_1_DI_1_0);

      const lambda_2 = BigInt(lambdas[1].toString());
      const DI_2_0 = pointFromSolidity(DIs[1][0]);
      const lambda_2_DI_2_0 = pointMul(jub, DI_2_0, lambda_2);
      console.log("lambda_2_DI_2_0: " + lambda_2_DI_2_0);

      const D = pointAdd(jub, lambda_1_DI_1_0, lambda_2_DI_2_0);
      console.log("D: " + D);

      const F = jub.F;
      const minus_D = [D[0], F.toString(F.sub(F.e("0"), jub.F.e(D[1])))];
      console.log("minus_D: " + minus_D);

      const M_sub_D = pointAdd(jub, M[0], minus_D);
      console.log("M_sub_D: " + M_sub_D);

      const expect_M_sub_D = pointFromScalar(jub, 5n);
      console.log("expect_M_sub_D: " + expect_M_sub_D);
    }
  }

  // 5. Recover the decrypted vote counts

  const vote_totals = (await nc.get_vote_totals()).map((x: BigNumber) => BigInt(x.toString()));
  console.log("vote_totals: " + vote_totals);
  expect(vote_totals).to.eql(expect_vote_totals);
}


main()
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});
