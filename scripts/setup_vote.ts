import * as zkvote_contract from "./nouns/zkvote_contract";
import * as dkg_contract from "./nouns/dkg_contract";
import { ZKVote } from "./nouns/zkvote_contract";
import { CommitteeMemberDKG, CommitteeMember } from "./nouns/committee_member";
import { command, run, number, string, positional, option } from 'cmd-ts';
import * as fs from 'fs';
import * as ethers from "ethers";
import { expect } from "chai";
const { buildBabyjub, buildPoseidonReference } = require('circomlibjs');

const app = command({
  name: 'setup_vote',
  args: {
    proposal_id: positional({
        type: number,
        displayName: 'proposal_id',
        description: "Proposal ID to get tally for",
      }),
    nc_descriptor_file: option({
      type: string,
      description: "Nouns descriptor file location",
      long: 'nc_descriptor',
      short: 'zkv',
      defaultValue: () => "./nouns.config.json",
      defaultValueIsSerializable: true,
    }),
    vote_threshold: option({
      type: number,
      description: "Vote weight required to trigger tally protocol",
      long: 'vote-threshold',
      short: 'v',
      defaultValue: () => 10,
      defaultValueIsSerializable: true,
    }),
    endpoint: option({
      type: string,
      description: "RPC endpoint to connect to",
      long: 'rpc-endpoint',
      short: 'r',
      defaultValue: () => 'http://127.0.0.1:8545/',
      defaultValueIsSerializable: true,
    }),
  },
  handler: async ({ my_id, dc_descriptor_file, nc_descriptor_file, vote_threshold, endpoint }) => {

    expect(my_id).is.greaterThan(0);

    // Load descriptor file
    const zkv_descriptor: zkvote_contract.ZKVoteContractDescriptor = JSON.parse(
      fs.readFileSync(nc_descriptor_file, 'utf8'));

    const dkg_descriptor: dkg_contract.DKGContractDescriptor  = JSON.parse(
      fs.readFileSync(dc_descriptor_file, 'utf8'));

    expect(my_id).is.lessThanOrEqual(dkg_descriptor.n_comm);

    // Connect
    const provider = new ethers.providers.JsonRpcProvider(endpoint);
    const accounts = await provider.listAccounts();

    // Initialize the committee member object
    const dkg_member = await CommitteeMemberDKG.initialize(
      await buildBabyjub(),
      await buildPoseidonReference(),
      dkg_descriptor,
      zkv_descriptor,
      provider.getSigner(my_id),
      my_id,
    );

    // Run the DKG
    const member = await run_DKG(dkg_member);
    console.log("DKG complete.");

    // Wait for voting power
    await wait_for_votes(dkg_member.zkv, BigInt(vote_threshold));

    // Run the tally algorithm
    await member.tallyVotes(Number(dummyProposalId));
    console.log("tallied");
    process.exit(0);
  }
});


run(app, process.argv.slice(2));
