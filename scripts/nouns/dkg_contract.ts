
import {
  DKG, DKG__factory, Round2Verifier__factory,
} from "../types";
import { Signer, Contract } from "ethers";
import { Provider } from "@ethersproject/providers";
export { DKG } from "../types";


export type DKGContractDescriptor = {
  address: string;
  n_comm: number;
  threshold: number;
};


export async function deploy(
  deployer: Signer,
  threshold: number,
  committee: string[],
): Promise<DKG> {

  const verifier_contracts: Contract[] = await Promise.all([
    (new Round2Verifier__factory(deployer)).deploy(),
  ]);
  const verifiers = verifier_contracts.map(c => c.address);

  return await (new DKG__factory(deployer)).deploy(
    verifiers[0],
    threshold,
    committee,
  );
}


export async function get_descriptor(dkg: DKG): Promise<DKGContractDescriptor> {
  const n_comm = await dkg.n_comm();
  const threshold = await dkg.threshold();
  console.log("threshold: " + threshold);
  console.log("address: " + dkg.address);
  return {
    address: dkg.address,
    n_comm: parseInt(n_comm.toString()),
    threshold: parseInt(threshold.toString()),
  };
}


export function from_descriptor(
  provider: Provider,
  descriptor: DKGContractDescriptor,
): DKG {
  return DKG__factory.connect(descriptor.address, provider);
}

export function from_address(
  signer: Signer,
  address: string,
): DKG {
  return DKG__factory.connect(address, signer);
}
