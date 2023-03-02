import * as snarkjs from "snarkjs"

import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { poseidon } from "../../node_modules//@semaphore-protocol/identity/node_modules/circomlibjs"
import { BigNumberish } from "ethers"
import { Proof } from "@semaphore-protocol/proof"

export declare type FullProof = {
    proof: Proof;
    publicSignals: PublicSignals;
};
export declare type PublicSignals = {
    rc: BigNumberish;
    merkleRoot: BigNumberish;
};

export default async function generateProof(
    identity: Identity,
    group: Group,
    rand : bigint,
    wasmFile : string,
    zkeyFile : string
): Promise<FullProof> {
    console.log(new Date().toUTCString() + " generateProof...")
    const commitment = identity.generateCommitment()
    const merkleProof: MerkleProof = group.generateProofOfMembership(group.indexOf(commitment))

    const rc = poseidon([rand, identity.getNullifier()])
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        {
            identityTrapdoor: identity.getTrapdoor(),
            identityNullifier: identity.getNullifier(),
            treePathIndices: merkleProof.pathIndices,
            treeSiblings: merkleProof.siblings,
            r : rand
        },
        wasmFile,
        zkeyFile
    )

    const fullProof = {
        proof,
        publicSignals: {
            rc: publicSignals[0],
            merkleRoot: publicSignals[1]
        }
    }

    console.log(new Date().toUTCString() + " fullProof.publicSignals : ", fullProof.publicSignals)
    return fullProof
}