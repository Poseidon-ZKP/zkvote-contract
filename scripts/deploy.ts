import * as nouns_contract from "./nouns/nouns_contract";
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
    total_voting_power: option({
      type: number,
      description: "Total voting power supported",
      long: 'total-voting-power',
      short: 'T',
      defaultValue: () => 20,
      defaultValueIsSerializable: true,
    }),
    descriptor_file: option({
      type: string,
      description: "Descriptor file location to write",
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
      defaultValue: () => 'http://localhost:8545/',
      defaultValueIsSerializable: true,
    }),
  },
  handler: async (
    {n_comm, threshold, total_voting_power, descriptor_file, endpoint }
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

    const nouns = await nouns_contract.deploy(
      deployer, committee, BigInt(threshold), BigInt(total_voting_power));
    console.log("Nouns deployed at: " + nouns.address);

    // Write the description
    const desc = nouns_contract.get_descriptor(nouns);
    fs.writeFileSync(descriptor_file, JSON.stringify(desc));
    console.log("Descriptor written at: " + descriptor_file);
  },
});


run(app, process.argv.slice(2));
