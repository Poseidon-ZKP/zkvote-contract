import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai"
import * as fs from "fs";
import * as snarkjs from "snarkjs"

import { poseidonContract } from "circomlibjs"
import { PoseidonT3__factory, GroupVerifier__factory, Group__factory } from "./types";

import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { packToSolidityProof, SolidityProof } from "@semaphore-protocol/proof"
import { TREE_DEPTH } from "./helper";
import { poseidon } from "../node_modules//@semaphore-protocol/identity/node_modules/circomlibjs"

import { BigNumber } from "ethers";
import generateProof from "../library/group/proof";

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

    // deploy contract 1/4 : verifier
    const v16 = await (new GroupVerifier__factory(owner)).deploy()
    console.log("v16.address : " , v16.address)

    // deploy contract 2/4 : poseidon(2)
    const poseidonABI = poseidonContract.generateABI(2)
    const poseidonBytecode = poseidonContract.createCode(2)
    const PoseidonLibFactory = new ethers.ContractFactory(poseidonABI, poseidonBytecode, owner)
    const poseidonLib = await PoseidonLibFactory.deploy()
    await poseidonLib.deployed()
    const pt3 = PoseidonT3__factory.connect(poseidonLib.address, owner)
    console.log("pt3.address : " , pt3.address)

    // deploy contract 3/4 : M Tree
    const IncrementalBinaryTreeLibFactory = await ethers.getContractFactory("IncrementalBinaryTree", {
        libraries: {
            PoseidonT3: pt3.address
        }
    })
    const incrementalBinaryTreeLib = await IncrementalBinaryTreeLibFactory.deploy()
    await incrementalBinaryTreeLib.deployed()
    console.log("incrementalBinaryTreeLib.address : " , incrementalBinaryTreeLib.address)

    // deploy contract 4/4 : Semaphore Voting
    const ContractFactory = await ethers.getContractFactory("Group", {
        libraries: {
            IncrementalBinaryTree: incrementalBinaryTreeLib.address
        }
    })
    const sc = await (await ContractFactory.deploy([
         { contractAddress : v16.address, merkleTreeDepth : TREE_DEPTH }
    ])).deployed()
    const g = Group__factory.connect(sc.address, owner)
    console.log("g.address : " , g.address)
    
    // 1/3. create group
    const groupId = BigInt(1)
    let coordinator = owners[1]
    let tx = g.createGroup(groupId, TREE_DEPTH, coordinator.address)
    await expect(tx).to.emit(g, "GroupCreated").withArgs(groupId, TREE_DEPTH, 0)

    // 2/3. add Member
    const identity = new Identity("identity")
    const identityCommitment = identity.generateCommitment()
    tx = g.connect(coordinator).addMember(groupId, identityCommitment)
    await expect(tx).to.emit(g, "MemberAdded")
    .withArgs(
        groupId,
        0,
        identityCommitment,
        "13306836988436479785626102362873594397500830099933583678006749550837591407705"
    )

    const size = await g.getNumberOfMerkleTreeLeaves(groupId)
    expect(size).to.be.eq(1)

    // 3/3. verify
    const group = new Group(TREE_DEPTH)
    group.addMembers([identityCommitment])

    const rand : bigint = BigNumber.from(123456).toBigInt()
    const rc = poseidon([rand, identity.getNullifier()])

    const fullProof =  await generateProof(
        identity,
        group,
        rand,
        wasmFilePath,
        FILE_ZKEY_FINAL
    )

    // off-chain verify proof
    expect(await snarkjs.groth16.verify(
        vKey,
        [
            fullProof.publicSignals.rc,
            fullProof.publicSignals.merkleRoot
        ],
        fullProof.proof
    )).eq(true)

    let solidityProof: SolidityProof = packToSolidityProof(fullProof.proof)

    await g.verifyProof(rc, groupId, solidityProof)
}

main("group")
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});


