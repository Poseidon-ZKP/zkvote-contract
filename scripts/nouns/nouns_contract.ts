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
  zkVote: string,
): Promise<Nouns> {

  return await (new Nouns__factory(deployer)).deploy(
    zkVote,
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
