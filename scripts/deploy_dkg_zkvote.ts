import * as dkg_contract from "./nouns/dkg_contract";
import * as zkvote_contract from "./nouns/zkvote_contract";
import { command, run, number, string, positional, option } from 'cmd-ts';
import * as fs from 'fs';
import * as ethers from "ethers";
require('dotenv').config();

const app = command({
  name: 'deploy_dkg_zkvote',
  args: {
    keyfile: positional({
      type: string,
      displayName: 'keyfile',
      description: "JSON file with encrypted private key.",
    }),
    committee_file: positional({
      type: string,
      displayName: 'committee_file',
      description: "JSON file with addresses of committee members.",
    }),
    n_comm: option({
      type: number,
      description: "Total number of committee members",
      long: 'committee-members',
      short: 'n',
      defaultValue: () => 3,
      defaultValueIsSerializable: true,
    }),
    threshold: option({
      type: number,
      description: "Threshold of committee members required to decrypt votes",
      long: 'threshold',
      short: 't',
      defaultValue: () => 2,
      defaultValueIsSerializable: true,
    }),
    max_total_voting_weight: option({
      type: number,
      description: "Total voting power supported",
      long: 'total-voting-power',
      short: 'T',
      defaultValue: () => 20,
      defaultValueIsSerializable: true,
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
      description: "ZKVote contract descriptor file location",
      long: 'zkv_descriptor',
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
  handler: async (
    { keyfile, committee_file, n_comm, threshold, max_total_voting_weight, dc_descriptor_file, zkv_descriptor_file, endpoint }
  ) => {
    console.log("CONFIG: " + JSON.stringify({ n_comm, threshold, endpoint }));

    if (threshold > n_comm) { throw "invalid threshold"; }
    const password = process.env.KEYFILE_PASSWORD;

    const provider = new ethers.providers.JsonRpcProvider(endpoint);
    const encrypted_json = fs.readFileSync(keyfile, 'utf8');
    let deployer = await ethers.Wallet.fromEncryptedJson(encrypted_json, password);
    deployer = deployer.connect(provider);
    console.log("DEPLOYER: " + await deployer.getAddress());

    const committee_json = JSON.parse(fs.readFileSync(committee_file, 'utf8'));
    const committee = committee_json.committee;
    console.log("COMMITTEE:");
    committee.forEach((c, i) => console.log("  " + i + ": " + c));

    const dkg = await dkg_contract.deploy(deployer, threshold, committee);
    console.log("DKG deployed at: " + dkg.address);

    const dkg_desc = await dkg_contract.get_descriptor(dkg);
    console.log("dkg_desc=" + JSON.stringify(dkg_desc));
    fs.writeFileSync(dc_descriptor_file, JSON.stringify(dkg_desc));
    console.log("Descriptor written at: " + dc_descriptor_file);

    // A reasonable lower bound on the block number from which committee members can start filtering for events.
    const block_number_before_zkvote_deploy = await provider.getBlockNumber();

    const zkv = await zkvote_contract.deploy(deployer, dkg.address, BigInt(max_total_voting_weight));
    console.log("ZKVote deployed at: " + zkv.address);

    const zkv_desc = await zkvote_contract.get_descriptor(zkv, block_number_before_zkvote_deploy);
    console.log("zkv_desc=" + JSON.stringify(zkv_desc));
    fs.writeFileSync(zkv_descriptor_file, JSON.stringify(zkv_desc));
    console.log("Descriptor written at: " + zkv_descriptor_file);
  },
});


run(app, process.argv.slice(2));
