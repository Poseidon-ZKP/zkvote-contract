import * as zkvote_contract from "./nouns/zkvote_contract";
import * as dkg_contract from "./nouns/dkg_contract";
import { ZKVote } from "./nouns/zkvote_contract";
import { CommitteeMemberDKG, CommitteeMember } from "./nouns/committee_member";
import { command, run, number, string, positional, option } from 'cmd-ts';
import * as fs from 'fs';
import * as ethers from "ethers";
import { expect } from "chai";
const { buildBabyjub, buildPoseidonReference } = require('circomlibjs');



async function run_DKG(member: CommitteeMemberDKG): Promise<CommitteeMember> {
  member.round1();
  await member.round1_wait();

  console.log("Round 2 ...");
  member.round2();
  await member.round2_wait();
  console.log("Round 2 complete");

  // Construct our final secret share from the encrypted shares on-chain,
  // yielding full committee member objects.
  return await member.constructSecretShare();
}


async function wait_for_votes(zkv: ZKVote, vote_threshold: bigint): Promise<void> {

  while (true) {
    const cur_vote_weight_str = (await zkv.voting_weight_used()).toString();
    const cur_vote_weight = BigInt(cur_vote_weight_str);
    console.log("cur vote weight_str: " + cur_vote_weight_str);
    console.log("cur vote weight: " + cur_vote_weight.toString());
    console.log("vote_threshold: " + vote_threshold.toString());
    if (cur_vote_weight >= vote_threshold) {
      console.log("threshold reached");
      break;
    }

    // Sleep 100ms
    console.log("sleeping 100ms ...");
    await new Promise(r => setTimeout(r, 100));
  }
}


const app = command({
  name: 'committee',
  args: {
    my_id: positional({
      type: number,
      displayName: "my_id",
      description: "ID (from 1 up to n_voters) of this committee member",
    }),
    dc_descriptor_file: option({
      type: string,
      description: "DKG descriptor file location",
      long: 'dc_descriptor',
      short: 'dc',
      defaultValue: () => "./dkg.config.json",
      defaultValueIsSerializable: true,
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
    await member.tallyVotes();
    console.log("tallied");
    process.exit(0);
  }
});


run(app, process.argv.slice(2));
