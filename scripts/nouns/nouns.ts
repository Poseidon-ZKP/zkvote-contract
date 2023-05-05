import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  PublicKey, pointFromSolidity, pointFromScalar, pointAdd, pointMul,
  polynomial_evaluate_group,
} from "../crypto";
import {
    Nouns__factory, Round2Verifier__factory, NvoteVerifier__factory, TallyVerifier__factory,
} from "../types";
// import { round1 } from "./round1";
// import { round2 } from "./round2";
import { Vote, Voter, VoteRecord } from "./voter";
import { CommitteeMemberDKG } from "./committee_member";
const { buildBabyjub, buildPoseidonReference } = require('circomlibjs');


async function main(
) {
  // init
  const babyjub = await buildBabyjub()
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
  const N_COMM = 3
  expect(owners.length).to.be.greaterThanOrEqual(N_USER + N_COMM);

  const t = 2
  let COMMITEE: SignerWithAddress[] = [];
  for (let i = 0; i < N_COMM; i++) {
    COMMITEE.push(owners[i])
  }

  let USERS: SignerWithAddress[] = [];
  for (let i = 0 ; i < N_USER ; i++) {
    USERS.push(owners[N_COMM + i]);
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

  // 0. Create committee members
  const committee_dkg: CommitteeMemberDKG[] = COMMITEE.map(
    (signer, i) => CommitteeMemberDKG.initialize(
      babyjub, poseidon, nc, signer, N_COMM, t, i + 1)
  );

  //
  // 1. Key Generation Round 1 (Committee)
  //

  console.log("\n\n---- DKG ROUND1 ----");

  // Submit coefficient commitments
  committee_dkg.forEach(member => member.round1());

  // Wait for others
  await Promise.all(committee_dkg.map(member => member.round1_wait()));

  // Sanity checks
  console.log("");

  // Get expected PK by querying committee members
  const expect_PK = (() => {
    let PK_sum = committee_dkg[0].C_coeff_commitments[0];
    for (let i = 1 ; i < committee_dkg.length ; ++i) {
      const member_C_0 = committee_dkg[i].C_coeff_commitments[0];
      PK_sum = pointAdd(babyjub, PK_sum, member_C_0);
    }
    return PK_sum;
  })();
  const PK = pointFromSolidity(await nc.get_PK());
  expect(PK).to.eql(expect_PK)
  console.log("PK: " + JSON.stringify(PK));

  // Check the coefficients of the PK secret polynomial
  const PK_coeffs = (await nc.PK_coefficients()).map(pointFromSolidity);
  console.log("PK_coeffs: " + JSON.stringify(PK_coeffs));

  // Log the expected PK_i_ls
  {
    committee_dkg.forEach(member => {
      const pk_share = polynomial_evaluate_group(
        babyjub,
        PK_coeffs,
        BigInt(member.id));
      console.log("PK_share for " + member.id + ": " + pk_share);
    });
  }

  // Compute the committee IDs
  const committee_ids = committee_dkg.map(m => m.id);

  //
  // 2. Key Generation Round 2 (Committee)
  //

  console.log("\n\n---- DKG ROUND2 ----");

  // Compute and upload the encrypted shares
  expect(await nc.round2_complete()).to.be.false;
  committee_dkg.forEach(member => member.round2(committee_ids));

  // Wait for round 2 to finish
  await Promise.all(committee_dkg.map(
    member => member.round2_wait()
  ));
  expect(await nc.round2_complete()).to.be.true;

  // Construct our final secret share from the encrypted shares on-chain,
  // yielding full committee member objects.
  const committee = await Promise.all(committee_dkg.map(async member => {
    const full_member = await member.constructSecretShare();
    expect(full_member).is.not.null;
    return full_member;
  }));

  //
  // 3. User Voting
  //

  console.log("\n\n---- VOTE ----");

  const voters: Voter[] = USERS.map((signer, i) => {
    return new Voter(babyjub/*,poseidon */, signer, nc, V[i]);
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

    let expectM0 = pointFromScalar(babyjub, 0n);
    let expectR0 = pointFromScalar(babyjub, 0n);
    vote_records.forEach(vr => {
      expectM0 = pointAdd(babyjub, expectM0, vr.M[0]);
      expectR0 = pointAdd(babyjub, expectR0, vr.R[0]);
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
    await Promise.all(committee.slice(0, t).map(member => {
      return member.tallyVotes();
    }));
  } else {
    // For testing, deterministic vote order and check the tally data on the
    // contract.

    await committee[0].tallyVotes();
    await committee[1].tallyVotes();

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
      const lambda_1_DI_1_0 = pointMul(babyjub, DI_1_0, lambda_1);
      console.log("lambda_1_DI_1_0: " + lambda_1_DI_1_0);

      const lambda_2 = BigInt(lambdas[1].toString());
      const DI_2_0 = pointFromSolidity(DIs[1][0]);
      const lambda_2_DI_2_0 = pointMul(babyjub, DI_2_0, lambda_2);
      console.log("lambda_2_DI_2_0: " + lambda_2_DI_2_0);

      const D = pointAdd(babyjub, lambda_1_DI_1_0, lambda_2_DI_2_0);
      console.log("D: " + D);

      const F = babyjub.F;
      const minus_D = [D[0], F.toString(F.sub(F.e("0"), babyjub.F.e(D[1])))];
      console.log("minus_D: " + minus_D);

      const M_sub_D = pointAdd(babyjub, M[0], minus_D);
      console.log("M_sub_D: " + M_sub_D);

      const expect_M_sub_D = pointFromScalar(babyjub, 5n);
      console.log("expect_M_sub_D: " + expect_M_sub_D);
    }
  }

  // 5. Recover the decrypted vote counts

  console.log("\n\n---- VOTE COUNTS ----");
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
