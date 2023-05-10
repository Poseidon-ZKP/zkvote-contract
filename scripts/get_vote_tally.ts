import * as nouns_contract from "./nouns/nouns_contract";
import { Vote, Voter } from "./nouns/voter";
import { Nouns } from "./nouns/nouns_contract";
import { CommitteeMemberDKG, CommitteeMember } from "./nouns/committee_member";
import { command, run, number, string, positional, option } from 'cmd-ts';
import * as fs from 'fs';
import * as ethers from "ethers";
import { expect } from "chai";


const app = command({
  name: 'get_vote_tally',
  args: {
    descriptor_file: option({
      type: string,
      description: "Descriptor file location",
      long: 'descriptor',
      short: 'd',
      defaultValue: () => "./nouns.config.json",
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
  handler: async ({ descriptor_file, endpoint }) => {

    // Load descriptor file
    const nouns_descriptor: nouns_contract.NounsContractDescriptor = JSON.parse(
      fs.readFileSync(descriptor_file, 'utf8'));

    // Connect
    const provider = new ethers.providers.JsonRpcProvider(endpoint);
    const nc = nouns_contract.from_descriptor(provider, nouns_descriptor);


    console.log("Waiting for tally ...");

    // Loop until the vote totals come in
    while (true) {
      const vote_totals_bn = await nc.get_vote_totals();
      const vote_totals = vote_totals_bn.map(x => parseInt(x.toString()));
      if (vote_totals[0] + vote_totals[1] + vote_totals[2]) {
        console.log("vote totals:");
        console.log("  Abstain: " + vote_totals[0]);
        console.log("  Nay    : " + vote_totals[1]);
        console.log("  Yay    : " + vote_totals[2]);
        break;
      }

      // Sleep 100ms
      await new Promise(r => setTimeout(r, 100));
    }

    process.exit(0);
  }
});


run(app, process.argv.slice(2));
