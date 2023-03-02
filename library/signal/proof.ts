import * as snarkjs from "snarkjs"

import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { poseidon } from "../../node_modules//@semaphore-protocol/identity/node_modules/circomlibjs"
import { BigNumberish } from "ethers"
import { generateSignalHash, Proof } from "@semaphore-protocol/proof"

export declare type FullProof = {
    proof: Proof;
    publicSignals: PublicSignals;
};
export type PublicSignals = {
    rc: BigNumberish;
    nullifierHash: BigNumberish
    signalHash: BigNumberish
    externalNullifier: BigNumberish
}

export default async function generateProof(
    identity: Identity,
    rand : bigint,
    externalNullifier: BigNumberish,
    signal: string,
    wasmFile : string,
    zkeyFile : string
): Promise<FullProof> {
    console.log(new Date().toUTCString() + " generateProof...")

    const rc = poseidon([rand, identity.getNullifier()])
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        {
            r : rand,
            identityNullifier: identity.getNullifier(),
            externalNullifier : externalNullifier,
            signalHash: generateSignalHash(signal)
        },
        wasmFile,
        zkeyFile
    )

    const fullProof = {
        proof,
        publicSignals: {
            rc: publicSignals[0],
            nullifierHash: publicSignals[1],
            signalHash: publicSignals[2],
            externalNullifier: publicSignals[3]
        }
    }

    console.log(new Date().toUTCString() + " fullProof.publicSignals : ", fullProof.publicSignals)
    return fullProof
}