import * as zkvote_contract from "./nouns/zkvote_contract";
import * as dkg_contract from "./nouns/dkg_contract";
import { deriveDKGSecret, recoverCommitteeMember, CommitteeMemberDKG, CommitteeMember } from "./nouns/committee_member";
import { command, run, number, string, positional, option } from 'cmd-ts';
import * as fs from 'fs';
import * as ethers from "ethers";
import { expect } from "chai";
import { Filter } from "@ethersproject/providers";
const { buildBabyjub, buildPoseidonReference } = require('circomlibjs');
require('dotenv').config();

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

const app = command({
  name: 'committee',
  args: {
    keyfile: positional({
      type: string,
      displayName: 'keyfile',
      description: "JSON file with encrypted private key.",
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
      description: "Vote weight required to trigger tally protocol (-1: unused)",
      long: 'vote-threshold',
      short: 'v',
      defaultValue: () => -1,
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
  handler: async ({ keyfile, dc_descriptor_file, zkv_descriptor_file, vote_threshold, endpoint }) => {
    // Load descriptor file
    const zkv_descriptor: zkvote_contract.ZKVoteContractDescriptor = JSON.parse(
      fs.readFileSync(zkv_descriptor_file, 'utf8'));

    const dkg_descriptor: dkg_contract.DKGContractDescriptor = JSON.parse(
      fs.readFileSync(dc_descriptor_file, 'utf8'));

    // Connect
    const provider = new ethers.providers.JsonRpcProvider(endpoint);
    const dkg = dkg_contract.from_descriptor(provider, dkg_descriptor);
    const zkv = zkvote_contract.from_descriptor(provider, zkv_descriptor);

    // Get the signer for this committee member and generate the DKG secret
    // key.
    const password = process.env.KEYFILE_PASSWORD;
    const encrypted_json = fs.readFileSync(keyfile, 'utf8');
    let signer = await ethers.Wallet.fromEncryptedJson(encrypted_json, password);
    signer = signer.connect(provider);

    const my_id = await dkg.get_committee_id_from_address(signer.address);
    expect(my_id).is.greaterThan(0);
    expect(my_id).is.lessThanOrEqual(dkg_descriptor.n_comm);

    const babyjub = await buildBabyjub();
    const poseidon = await buildPoseidonReference();

    const a_0 = await deriveDKGSecret(babyjub, signer)

    // Attempt to recover our committee secret, otherwise assume we need to
    // run the DKG.
    console.log("attempting to recover committee secret from chain ...");
    let member = await recoverCommitteeMember(
      babyjub, poseidon, dkg, zkv, signer, a_0);
    if (member === null) {
      console.log("failed to recover from chain.  Running DKG ...");
      // Initialize the committee member object
      const dkg_member = await CommitteeMemberDKG.initialize(
        babyjub,
        poseidon,
        dkg_descriptor,
        zkv_descriptor,
        signer,
        Number(my_id),
        a_0
      );

      // Run the DKG
      member = await run_DKG(dkg_member);
      console.log("DKG complete.");
    } else {
      console.log("Recovery succeeded.");
    }

    // Run the vote tallier
    console.log("Running vote tallier...");

    let lastBlockFiltered = zkv_descriptor.block_number_before_zkvote_deploy;
    const intfc = zkv.interface;
    let proposalIdToEndBlock: Map<number, number> = new Map<number, number>();
    while (true) {
      // Query for new setup proposal events
      const currentBlockNumber = await provider.getBlockNumber();
      if (currentBlockNumber > lastBlockFiltered) {
        const filter: Filter = zkv.filters.SetupVote();
        filter.fromBlock = lastBlockFiltered + 1;
        filter.toBlock = currentBlockNumber;
        const logs = await provider.getLogs(filter);
        lastBlockFiltered = currentBlockNumber;
        for (const log of logs) {
          const parsedLog = intfc.parseLog(log);
          const proposalId = parsedLog.args.proposalId;
          const endBlock = parsedLog.args.endBlock;
          proposalIdToEndBlock.set(proposalId, endBlock);
        }
      }

      // For each active proposal, check if the endBlock has elapsed.  If so,
      // trigger the tally process and remove the proposal from the active
      // list.  If vote_threshold > 0, the tally can be triggered early if the
      // vote weight goes above vote_threshold.
      for (const [proposalId, endBlock] of proposalIdToEndBlock.entries()) {
        if (currentBlockNumber >= endBlock) {
          await member.tallyVotes(proposalId);
          console.log("Tally complete for proposalId: " + proposalId.toString());
          proposalIdToEndBlock.delete(proposalId);
        } else if (vote_threshold > 0) {
          const cur_vote_weight_str = (await zkv.voting_weight_used(proposalId)).toString();
          const cur_vote_weight = BigInt(cur_vote_weight_str);
          console.log("cur vote weight_str: " + cur_vote_weight_str, "proposalId: " + proposalId.toString());
          console.log("vote_threshold: " + vote_threshold.toString());
          if (cur_vote_weight >= vote_threshold) {
            await member.tallyVotes(proposalId);
            console.log("Tally complete for proposalId: " + proposalId.toString());
            proposalIdToEndBlock.delete(proposalId);
          }
        }
      }
      // Sleep for 300ms
      // console.log("sleeping 300ms ...");
      await new Promise(r => setTimeout(r, 300));
    }
  }
});

run(app, process.argv.slice(2));
