import * as zkvote_contract from "./nouns/zkvote_contract";
import { command, run, number, string, positional, option } from 'cmd-ts';
import * as fs from 'fs';
import * as ethers from "ethers";

const app = command({
  name: 'setup_vote',
  args: {
    proposal_id: positional({
      type: number,
      displayName: 'proposal_id',
      description: "Proposal ID to get tally for",
    }),
    end_block: positional({
      type: number,
      displayName: 'end_block',
      description: "end block for proposal",
    }),
    zk_descriptor_file: option({
      type: string,
      description: "Nounds descriptor file location to write",
      long: 'descriptor',
      short: 'd',
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
  handler: async ({ proposal_id, end_block, zk_descriptor_file, endpoint }) => {
    // Load descriptor file
    const nc_descriptor: zkvote_contract.ZKVoteContractDescriptor = JSON.parse(
      fs.readFileSync(zk_descriptor_file, 'utf8'));

    // Connect
    const provider = new ethers.providers.JsonRpcProvider(endpoint);
    const signer = provider.getSigner();
    // Load contract
    let zk = zkvote_contract.from_descriptor(provider, nc_descriptor);

    zk = zk.connect(signer);

    // Setup Vote
    const tx = await zk.setupVote(proposal_id, end_block);
    await tx.wait();
    console.log("Setup vote for proposal ID", proposal_id);
    process.exit(0);
  }
});


run(app, process.argv.slice(2));
