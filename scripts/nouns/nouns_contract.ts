
import {
  Nouns, Nouns__factory, Round2Verifier__factory, NvoteVerifier__factory,
  TallyVerifier__factory,
} from "../types";
import { Signer, Contract } from "ethers";
import { Provider } from "@ethersproject/providers";
export { Nouns } from "../types";


export type NounsContractDescriptor = {
  address: string;
  n_comm: number,
  threshold: number,
};


export async function deploy(
  deployer: Signer,
  committee: string[],
  threshold: bigint,
  total_voting_power: bigint,
): Promise<Nouns> {

  const verifier_contracts: Contract[] = await Promise.all([
    (new Round2Verifier__factory(deployer)).deploy(),
    (new NvoteVerifier__factory(deployer)).deploy(),
    (new TallyVerifier__factory(deployer)).deploy(),
  ]);
  const verifiers = verifier_contracts.map(c => c.address);

  return await (new Nouns__factory(deployer)).deploy(
    verifiers,
    committee,
    threshold,
    total_voting_power
  );
}


export async function get_descriptor(nouns: Nouns): Promise<NounsContractDescriptor> {
  const n_comm = await nouns.n_comm();
  const threshold = await nouns.tally_threshold();
  console.log("n_comm: " + n_comm);
  console.log("threshold: " + threshold);
  console.log("address: " + nouns.address);
  return {
    address: nouns.address,
    n_comm: parseInt(n_comm.toString()),
    threshold: parseInt(threshold.toString()),
  };
}


export function from_descriptor(
  provider: Provider,
  descriptor: NounsContractDescriptor,
): Nouns {
  return Nouns__factory.connect(descriptor.address, provider);
}
