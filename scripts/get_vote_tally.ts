import * as zkvote_contract from "./nouns/zkvote_contract";
import { command, run, string, option, positional, number } from 'cmd-ts';
import * as fs from 'fs';
import * as ethers from "ethers";


const app = command({
  name: 'get_vote_tally',
  args: {
    proposal_id: positional({
      type: number,
      displayName: 'proposal_id',
      description: "Proposal ID to get tally for",
    }),
    zkv_descriptor_file: option({
      type: string,
      description: "ZKVote descriptor file location",
      long: 'descriptor',
      short: 'zkv',
      defaultValue: () => "./zkv.config.json",
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
  handler: async ({ proposal_id, zkv_descriptor_file, endpoint }) => {

    // Load descriptor file
    const zkv_descriptor: zkvote_contract.ZKVoteContractDescriptor = JSON.parse(
      fs.readFileSync(zkv_descriptor_file, 'utf8'));

    // Connect
    const provider = new ethers.providers.JsonRpcProvider(endpoint);
    const zkv = zkvote_contract.from_descriptor(provider, zkv_descriptor);

    console.log(`Waiting for tally for proposal id ${proposal_id}...`);

    // Loop until the vote totals come in
    while (true) {
      const vote_totals_bn = await zkv.get_vote_totals(proposal_id);
      const vote_totals = vote_totals_bn.map(x => parseInt(x.toString()));
      console.log("vote totals:", vote_totals);
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
