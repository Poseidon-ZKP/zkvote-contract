import * as nouns_contract from "./nouns/nouns_contract";
import { Vote, Voter } from "./nouns/voter";
import * as dkg_contract from "./nouns/dkg_contract";
import { Nouns } from "./nouns/nouns_contract";
import { CommitteeMemberDKG, CommitteeMember } from "./nouns/committee_member";
import { command, run, number, string, positional, option } from 'cmd-ts';
import * as fs from 'fs';
import * as ethers from "ethers";
import { expect } from "chai";


function parse_vote(vote: string): Vote {
  switch (vote.toLowerCase()) {
    case "yay": return Vote.Yay;
    case "nay": return Vote.Nay;
    case "abstain": return Vote.Abstain;
    default: break;
  }

  throw "unrecognized vote: " + vote + ".  Use yay, nay or abstain.";
}



const app = command({
  name: 'voter',
  args: {
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
      long: 'descriptor',
      short: 'd',
      defaultValue: () => "./nouns.config.json",
      defaultValueIsSerializable: true,
    }),
    // vote_threshold: option({
    //   type: number,
    //   description: "Vote weight required to trigger tally protocol",
    //   long: 'vote-threshold',
    //   short: 'v',
    //   defaultValue: () => 10,
    //   defaultValueIsSerializable: true,
    // }),
    endpoint: option({
      type: string,
      description: "RPC endpoint to connect to",
      long: 'rpc-endpoint',
      short: 'r',
      defaultValue: () => 'http://127.0.0.1:8545/',
      defaultValueIsSerializable: true,
    }),
    my_id: positional({
      type: number,
      displayName: "my_id",
      description: "ID (from 1 upwards) of this voter (used to select a hosted wallet)",
    }),
    vote_str: positional({
      type: string,
      displayName: "vote",
      description: "Vote (yay, nay or abstain)",
    }),
    vote_weight: positional({
      type: number,
      displayName: "vote_weight",
      description: "Voting weight"
    }),
  },
  handler: async ({ dc_descriptor_file, nc_descriptor_file, endpoint, my_id, vote_str, vote_weight }) => {

    expect(my_id).is.greaterThan(0);

    const vote = parse_vote(vote_str);
    console.log("vote: " + vote);

    // Load descriptor file
    const dkg_descriptor: dkg_contract.DKGContractDescriptor = JSON.parse(
      fs.readFileSync(dc_descriptor_file, 'utf8'));

    const nouns_descriptor: nouns_contract.NounsContractDescriptor = JSON.parse(
      fs.readFileSync(nc_descriptor_file, 'utf8'));
    expect(my_id).is.lessThanOrEqual(dkg_descriptor.n_comm);

    // Connect
    const provider = new ethers.providers.JsonRpcProvider(endpoint);

    // Initialize the voter.  Assume committee members use accounts with index
    // 1 through n_comm (0 used for deployer).  Since voter indices are also
    // 1-based, voter 1 uses the signer with index n_comm + my_id.
    const signer_idx = dkg_descriptor.n_comm + my_id;
    const signer = provider.getSigner(signer_idx);
    const voter = await Voter.initialize(signer, nouns_descriptor);
    const dummyProposalId = 0;

    // Register the voter
    await voter.dummy_register(dummyProposalId, BigInt(vote_weight));

    // Vote and wait
    const vote_record = await voter.cast_vote(dummyProposalId, vote);
    console.log(JSON.stringify(vote_record));

    process.exit(0);
  }
});


run(app, process.argv.slice(2));
