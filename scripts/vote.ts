import * as nouns_contract from "./nouns/nouns_contract";
import { Vote, Voter } from "./nouns/voter";
import * as dkg_contract from "./nouns/dkg_contract";
import { Nouns } from "./nouns/nouns_contract";
import { CommitteeMemberDKG, CommitteeMember } from "./nouns/committee_member";
import { command, run, number, string, positional, option } from 'cmd-ts';
import * as fs from 'fs';
import * as ethers from "ethers";
import { expect } from "chai";
require('dotenv').config();


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
    proposal_id: positional({
      type: number,
      displayName: 'proposal_id',
      description: "Proposal ID to get tally for",
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
    keyfile: positional({
      type: string,
      displayName: 'keyfile',
      description: "JSON file with encrypted private key.",
    }),
  },
  handler: async ({ keyfile, proposal_id, dc_descriptor_file, nc_descriptor_file, endpoint, vote_str, vote_weight }) => {
    const vote = parse_vote(vote_str);
    console.log("vote: " + vote);

    // Load descriptor file
    const nouns_descriptor: nouns_contract.NounsContractDescriptor = JSON.parse(
      fs.readFileSync(nc_descriptor_file, 'utf8'));

    const password = process.env.KEYFILE_PASSWORD || '';

    const provider = new ethers.providers.JsonRpcProvider(endpoint);
    const encrypted_json = fs.readFileSync(keyfile, 'utf8');
    let signer = await ethers.Wallet.fromEncryptedJson(encrypted_json, password);
    signer = signer.connect(provider);
    const voter = await Voter.initialize(signer, nouns_descriptor);

    // Register the voter
    await voter.dummy_register(proposal_id, BigInt(vote_weight));

    // Vote and wait
    const vote_record = await voter.cast_vote(proposal_id, vote);
    console.log(JSON.stringify(vote_record));

    process.exit(0);
  }
});


run(app, process.argv.slice(2));
