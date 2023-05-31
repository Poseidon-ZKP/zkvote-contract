import * as nouns_contract from "./nouns/nouns_contract";
import * as dkg_contract from "./nouns/dkg_contract";
import * as zkvote_contract from "./nouns/zkvote_contract";
import { command, run, number, string, option } from 'cmd-ts';
import * as fs from 'fs';
import * as ethers from "ethers";

const app = command({
  name: 'deploy',
  args: {
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
    { n_comm, threshold, max_total_voting_weight, dc_descriptor_file, zkv_descriptor_file, nc_descriptor_file, endpoint }
  ) => {
    console.log("CONFIG: " + JSON.stringify({ n_comm, threshold, endpoint }));

    if (threshold > n_comm) { throw "invalid threshold"; }

    // For now, assume the endpoint has some managed wallets.  Use 0 as the
    // deployer and 1 ~ N as the committee members.

    const provider = new ethers.providers.JsonRpcProvider(endpoint);
    const accounts = await provider.listAccounts();

    const deployer = provider.getSigner(0);
    console.log("DEPLOYER: " + await deployer.getAddress());

    const committee = accounts.slice(1, n_comm + 1);
    console.log("COMMITTEE:");
    committee.forEach((c, i) => console.log("  " + i + ": " + c));

    const dkg = await dkg_contract.deploy(deployer, threshold, committee);
    console.log("DKG deployed at: " + dkg.address);

    const dkg_desc = await dkg_contract.get_descriptor(dkg);
    console.log("dkg_desc=" + JSON.stringify(dkg_desc));
    fs.writeFileSync(dc_descriptor_file, JSON.stringify(dkg_desc));
    console.log("Descriptor written at: " + dc_descriptor_file);

    const zkv = await zkvote_contract.deploy(deployer, dkg.address, BigInt(max_total_voting_weight));
    console.log("ZKVote deployed at: " + zkv.address);

    const zkv_desc = await zkvote_contract.get_descriptor(zkv);
    console.log("zkv_desc=" + JSON.stringify(zkv_desc));
    fs.writeFileSync(zkv_descriptor_file, JSON.stringify(zkv_desc));
    console.log("Descriptor written at: " + zkv_descriptor_file);

    const nouns = await nouns_contract.deploy(
      deployer, zkv.address);
    console.log("Nouns deployed at: " + nouns.address);

    // Write the description
    const nouns_desc = await nouns_contract.get_descriptor(nouns);
    console.log("nouns_desc=" + JSON.stringify(nouns_desc));
    fs.writeFileSync(nc_descriptor_file, JSON.stringify(nouns_desc));
    console.log("Descriptor written at: " + nc_descriptor_file);
  },
});


run(app, process.argv.slice(2));
