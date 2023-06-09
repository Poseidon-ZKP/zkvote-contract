import * as nouns_contract from "./nouns/nouns_contract";
import * as zkvote_contract from "./nouns/zkvote_contract";
import { command, run, string, option, positional } from 'cmd-ts';
import * as fs from 'fs';
import { Wallet, ethers } from "ethers";
require('dotenv').config();

const app = command({
  name: 'deploy_dummy_nouns',
  args: {
    keyfile: positional({
      type: string,
      displayName: 'keyfile',
      description: "JSON file with encrypted private key.",
    }),
    zkv_descriptor_file: option({
      type: string,
      description: "ZKVote contract descriptor file location",
      long: 'zkv_descriptor',
      short: 'zkv',
      defaultValue: () => "./zkv.config.json",
      defaultValueIsSerializable: true,
    }),
    nc_descriptor_file: option({
      type: string,
      description: "Nounds descriptor file location to write",
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
  handler: async (
    { keyfile, zkv_descriptor_file, nc_descriptor_file, endpoint }
  ) => {
    const password = process.env.KEYFILE_PASSWORD;

    const provider = new ethers.providers.JsonRpcProvider(endpoint);
    const encrypted_json = fs.readFileSync(keyfile, 'utf8');
    let deployer = await ethers.Wallet.fromEncryptedJson(encrypted_json, password);
    deployer = deployer.connect(provider);
    console.log("DEPLOYER: " + await deployer.getAddress());

    const zkv_descriptor: zkvote_contract.ZKVoteContractDescriptor = JSON.parse(
      fs.readFileSync(zkv_descriptor_file, 'utf8'));

    const nouns = await nouns_contract.deploy(
      deployer, zkv_descriptor.address);
    console.log("Nouns deployed at: " + nouns.address);

    // Write the description
    const nouns_desc = await nouns_contract.get_descriptor(nouns);
    console.log("nouns_desc=" + JSON.stringify(nouns_desc));
    fs.writeFileSync(nc_descriptor_file, JSON.stringify(nouns_desc));
    console.log("Descriptor written at: " + nc_descriptor_file);
  },
});


run(app, process.argv.slice(2));
