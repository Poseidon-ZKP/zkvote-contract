
import {
  Nouns, Nouns__factory, NvoteVerifier__factory,
  TallyVerifier__factory,
} from "../types";
import { Signer, Contract } from "ethers";
import { Provider } from "@ethersproject/providers";
export { Nouns } from "../types";


export type NounsContractDescriptor = {
  address: string;
};


export async function deploy(
  deployer: Signer,
  dkg_address: string,
  total_voting_power: bigint,
): Promise<Nouns> {

  const verifier_contracts: Contract[] = await Promise.all([
    (new NvoteVerifier__factory(deployer)).deploy(),
    (new TallyVerifier__factory(deployer)).deploy(),
  ]);
  const verifiers = verifier_contracts.map(c => c.address);

  return await (new Nouns__factory(deployer)).deploy(
    dkg_address,
    verifiers,
    total_voting_power
  );
}


export async function get_descriptor(nouns: Nouns): Promise<NounsContractDescriptor> {
  console.log("address: " + nouns.address);
  return {
    address: nouns.address,
  };
}


export function from_descriptor(
  provider: Provider,
  descriptor: NounsContractDescriptor,
): Nouns {
  return Nouns__factory.connect(descriptor.address, provider);
}
