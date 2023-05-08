
import {
  Nouns, Nouns__factory, Round2Verifier__factory, NvoteVerifier__factory,
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


export function get_descriptor(nouns: Nouns): NounsContractDescriptor {
  return { address: nouns.address };
}


export function from_descriptor(
  provider: Provider,
  descriptor: NounsContractDescriptor,
): Nouns {
  return Nouns__factory.connect(descriptor.address, provider);
}
