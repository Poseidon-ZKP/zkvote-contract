import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai"
import * as fs from "fs";
import * as snarkjs from "snarkjs"

import { Identity } from "@semaphore-protocol/identity"
import { packToSolidityProof, SolidityProof } from "@semaphore-protocol/proof"
import { exit } from "process";
import { poseidon } from "../node_modules//@semaphore-protocol/identity/node_modules/circomlibjs"

import { BigNumber } from "ethers";
import generateProof from "../library/signal/proof";
import { SignalVerifier__factory, Signal__factory } from "./types";

async function main(
    CUR_CIRCUIT : string
) {

    const DIR = process.cwd()
    console.log("WORK DIR : ", DIR)
    const CIRCUIT_TGT_DIR = DIR + "/circuits/" + CUR_CIRCUIT + "/"
    const wasmFilePath = CIRCUIT_TGT_DIR + CUR_CIRCUIT + "_js/" + CUR_CIRCUIT + ".wasm"
    const FILE_ZKEY_FINAL = CIRCUIT_TGT_DIR + "zkey.16"

    const zkey_final = {type: "mem", data : undefined};
	zkey_final.data = new Uint8Array(Buffer.from(fs.readFileSync(FILE_ZKEY_FINAL)))
    const vKey = await snarkjs.zKey.exportVerificationKey(zkey_final);
	console.log("vKey.protocol : ", vKey.protocol)


    const owners = await ethers.getSigners()
    let owner : SignerWithAddress = owners[0]

    // deploy contract 1/2 : verifier
    const v = await (new SignalVerifier__factory(owner)).deploy()
    console.log("v.address : " , v.address)

    // deploy contract 2/2 : Signal
    const s = await (new Signal__factory(owner)).deploy(v.address)
    console.log("s.address : " , s.address)

    // signal msg
    const rand : bigint = BigNumber.from(123456).toBigInt()
    const identity = new Identity("initAddVoter")
    const rc = poseidon([rand, identity.getNullifier()])

    const externalNullifier = 1
    const msg = "msg 1"
    const bytes32msg = ethers.utils.formatBytes32String(msg)
    const fullProof =  await generateProof(
        identity,
        rand,
        externalNullifier,
        msg,
        wasmFilePath,
        FILE_ZKEY_FINAL
    )

    // off-chain verify proof
    expect(await snarkjs.groth16.verify(
        vKey,
        [
            fullProof.publicSignals.rc,
            fullProof.publicSignals.nullifierHash,
            fullProof.publicSignals.signalHash,
            fullProof.publicSignals.externalNullifier
        ],
        fullProof.proof
    )).eq(true)

    let solidityProof: SolidityProof = packToSolidityProof(fullProof.proof)

    await (await s.signal(
        rc,
        bytes32msg,
        fullProof.publicSignals.nullifierHash,
        externalNullifier,
        solidityProof
    )).wait()
}

main("signal")
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});


