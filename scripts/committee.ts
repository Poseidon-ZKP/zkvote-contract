import * as zkvote_contract from "./nouns/zkvote_contract";
import * as dkg_contract from "./nouns/dkg_contract";
import { ZKVote } from "./nouns/zkvote_contract";
import { CommitteeMemberDKG, CommitteeMember } from "./nouns/committee_member";
import { command, run, number, string, positional, option } from 'cmd-ts';
import * as fs from 'fs';
import * as ethers from "ethers";
import { expect } from "chai";
const { buildBabyjub, buildPoseidonReference } = require('circomlibjs');
import { Provider, Filter, Log } from "@ethersproject/providers";

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

async function wait_for_vote_and_tally(provider: Provider, member: CommitteeMember, zkv: ZKVote, proposalId: number, vote_threshold: bigint): Promise<void> {
  const intfc = zkv.interface;
  while (true) {
    const cur_vote_weight_str = (await zkv.voting_weight_used(proposalId)).toString();
    const cur_vote_weight = BigInt(cur_vote_weight_str);
    console.log("cur vote weight_str: " + cur_vote_weight_str);
    console.log("cur vote weight: " + cur_vote_weight.toString());
    console.log("vote_threshold: " + vote_threshold.toString());
    if (cur_vote_weight >= vote_threshold) {
      const filter: Filter = zkv.filters.TallyComplete(proposalId);
      filter.fromBlock = 0;
      filter.toBlock = "latest";
      const logs = await provider.getLogs(filter);
      if (logs.length == 0) {
        console.log(`threshold reached for proposal id ${proposalId}... tallying`);
        await member.tallyVotes(proposalId);
      } else {
        console.log(`threshold reached for proposal id ${proposalId} but vote already tallied by another committee member`);
      }
      break;
    }

    // Sleep 100ms
    console.log("sleeping 100ms ...");
    await new Promise(r => setTimeout(r, 100));
  }
}

async function run_vote_tallier(provider: Provider, member: CommitteeMember, zkv: ZKVote, vote_threshold: bigint): Promise<void> {
  let lastBlockFiltered = 0;
  const intfc = zkv.interface;
  while (true) {
    const newProposalIdSet = new Set<number>();
    // Query for new setup proposal events
    const filter: Filter = zkv.filters.SetupVote();
    filter.fromBlock = lastBlockFiltered;
    filter.toBlock = "latest";
    const logs = await provider.getLogs(filter);
    lastBlockFiltered = logs.length > 0 ? logs[logs.length - 1].blockNumber : lastBlockFiltered;
    for (const log of logs) {
      const parsedLog = intfc.parseLog(log);
      const proposalId = parsedLog.args.proposalId;
      newProposalIdSet.add(proposalId);
    }
    // wait_for_vote_and_tally
    for (const proposalId of newProposalIdSet) {
      console.log("waiting for votes for proposalId: " + proposalId.toString());
      wait_for_vote_and_tally(provider, member, zkv, proposalId, vote_threshold);
    }
    // Sleep for 300ms
    // console.log("sleeping 300ms ...");
    await new Promise(r => setTimeout(r, 300));
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
    zkv_descriptor_file: option({
      type: string,
      description: "ZKVote descriptor file location",
      long: 'descriptor',
      short: 'zkv',
      defaultValue: () => "./zkv.config.json",
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
  handler: async ({ my_id, dc_descriptor_file, zkv_descriptor_file, vote_threshold, endpoint }) => {

    expect(my_id).is.greaterThan(0);

    // Load descriptor file
    const zkv_descriptor: zkvote_contract.ZKVoteContractDescriptor = JSON.parse(
      fs.readFileSync(zkv_descriptor_file, 'utf8'));

    const dkg_descriptor: dkg_contract.DKGContractDescriptor  = JSON.parse(
      fs.readFileSync(dc_descriptor_file, 'utf8'));

    expect(my_id).is.lessThanOrEqual(dkg_descriptor.n_comm);

    // Connect
    const provider = new ethers.providers.JsonRpcProvider(endpoint);

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

    const zkv = zkvote_contract.from_descriptor(provider, zkv_descriptor);

    // Run the vote tallyer
    console.log("Running vote tallier...");
    await run_vote_tallier(provider, member, zkv, BigInt(vote_threshold));

    process.exit(0);
  }
});

run(app, process.argv.slice(2));
