import {
  ZKVote, ZKVote__factory, NvoteVerifier__factory,
  TallyVerifier__factory,
} from "../types";
import { Signer, Contract } from "ethers";
import { Provider } from "@ethersproject/providers";
export { ZKVote } from "../types";

export type ZKVoteContractDescriptor = {
  address: string;
  block_number_before_zkvote_deploy: number;
};

export async function deploy(
  deployer: Signer,
  _dkg_address: string,
  max_total_voting_weight: bigint,
): Promise<ZKVote> {

  const verifier_contracts: Contract[] = await Promise.all([
    (new NvoteVerifier__factory(deployer)).deploy(),
    (new TallyVerifier__factory(deployer)).deploy(),
  ]);
  const verifiers = verifier_contracts.map(c => c.address);

  return await (new ZKVote__factory(deployer)).deploy(
    _dkg_address,
    max_total_voting_weight,
    verifiers,
  );
}

export async function get_descriptor(zkVote: ZKVote, block_number_before_zkvote_deploy: number): Promise<ZKVoteContractDescriptor> {
  console.log("address: " + zkVote.address);
  console.log("block_number_before_zkvote_deploy: " + block_number_before_zkvote_deploy);
  return {
    address: zkVote.address,
    block_number_before_zkvote_deploy,
  };
}

export function from_descriptor(
  provider: Provider,
  descriptor: ZKVoteContractDescriptor,
): ZKVote {
  return ZKVote__factory.connect(descriptor.address, provider);
}

export function from_address(
  signer: Signer,
  address: string,
): ZKVote {
  return ZKVote__factory.connect(address, signer);
}
