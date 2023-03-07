import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { poseidonContract } from "circomlibjs"

import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { packToSolidityProof, SolidityProof } from "@semaphore-protocol/proof"
import { get_circuit_wasm_file, get_circuit_zkey_file, REVERT_REASON_ALREADY_SIGNAL, REVERT_REASON_HEADER, REVERT_REASON_ID_EXIST_IN_GROUP, REVERT_REASON_MISS_NFT, REVERT_REASON_ONLY_ADMIN, TREE_DEPTH } from "./helper";
import { exit } from "process";
import { poseidon } from "../node_modules//@semaphore-protocol/identity/node_modules/circomlibjs"

import { BigNumber, ContractFactory } from "ethers";

import { default as generateGroupProof} from "../library/group/proof";
import { default as generateSignalProof} from "../library/signal/proof";
import { PoseidonT3__factory, GroupVerifier__factory, Group__factory, SignalVerifier__factory, Signal__factory, Vote__factory, Vote, VoteNFT__factory, VoteNFT } from "./types";

import * as fs from 'fs';
import { verify, verify2, writeToEnv } from "./utils/common";
import { upgrades } from "hardhat" 
import { expect } from "chai"
const hre = require('hardhat');

async function deploy_nft(
    owner :SignerWithAddress
) : Promise<VoteNFT> {

    // deploy nft
    const params = ["zkvote nft", "zkvote"]
    const vnft = await (new VoteNFT__factory(owner)).deploy(params[0], params[1])
    console.log("vnft.address : " , vnft.address)
    writeToEnv("VNFT", vnft.address)
    // await verify2(vnft.address, ["zkvote nft", "zkvote"])
    
    return vnft
}

async function deploy(
    owner
) : Promise<Vote> {

    // deploy contract 1/7 : group verifier
    const gvf = new GroupVerifier__factory(owner)
    const group_verifier = await upgrades.deployProxy(gvf);
    await group_verifier.deployed();
    console.log("group_verifier.address : " , group_verifier.address)
    await verify(group_verifier.address)

    // deploy contract 2/7 : poseidon(2)
    const NINPUT = 2
    const poseidonABI = poseidonContract.generateABI(NINPUT)
    const poseidonBytecode = poseidonContract.createCode(NINPUT)
    const PoseidonLibFactory = new ethers.ContractFactory(poseidonABI, poseidonBytecode, owner)
    const poseidonLib = await PoseidonLibFactory.deploy()
    await poseidonLib.deployed()
    const pt3 = PoseidonT3__factory.connect(poseidonLib.address, owner)
    console.log("pt3.address : " , pt3.address)
    
    // deploy contract 3/7 : M Tree
    const IncrementalBinaryTreeLibFactory = await ethers.getContractFactory("IncrementalBinaryTree", {
        libraries: {
            PoseidonT3: pt3.address
        }
    })
    const incrementalBinaryTreeLib = await IncrementalBinaryTreeLibFactory.deploy()
    await incrementalBinaryTreeLib.deployed()
    console.log("incrementalBinaryTreeLib.address : " , incrementalBinaryTreeLib.address)

    // deploy contract 4/4 : group
    const ContractFactory = await ethers.getContractFactory("Group", {
        libraries: {
            IncrementalBinaryTree: incrementalBinaryTreeLib.address
        }
    })

    const groupArs = [
        {
            contractAddress : group_verifier.address,
            merkleTreeDepth : TREE_DEPTH
        }]
    const gc = await (await ContractFactory.deploy(groupArs)).deployed()
	// const gc = await upgrades.deployProxy(ContractFactory, [{
    //     _verifiers : [group_verifier.address]
    // }]);
	// await gc.deployed();
    const g = Group__factory.connect(gc.address, owner)
    console.log("g.address : " , g.address)
    await verify2(g.address, groupArs)
    
    // deploy contract 1/2 : signal verifier
    const svf = new SignalVerifier__factory(owner)
    const signal_verifier = await upgrades.deployProxy(svf);
	await signal_verifier.deployed();
    console.log("signal_verifier.address : " , signal_verifier.address)
    await verify(signal_verifier.address)

    // deploy contract 2/2 : Signal
    const s = await (new Signal__factory(owner)).deploy(signal_verifier.address)
    console.log("signal.address : " , s.address)
    await verify2(s.address, [signal_verifier.address])

    // deploy contract  : Vote
    const vf = new Vote__factory(owner)
    const VoteInitParams = [g.address, s.address]
    const v = await upgrades.deployProxy(vf, VoteInitParams)
    await v.deployed()
    console.log("vote.address : " , v.address)
    await verify2(v.address, VoteInitParams)

	let deploy_flag = "\n\n# ++++++ depoly " + hre.hardhatArguments.network + " on " + new Date().toUTCString() + " ++++++++++++"
	fs.appendFileSync('.env', deploy_flag)
	writeToEnv("PT3", pt3.address)
	writeToEnv("IBTree", incrementalBinaryTreeLib.address)
	writeToEnv("GROUP", g.address)
	writeToEnv("GROUP_VERIFIER", group_verifier.address)
	writeToEnv("SIGNAL", s.address)
	writeToEnv("SIGNAL_VERIFIER", signal_verifier.address)
	writeToEnv("VOTE", v.address)
    return v;
}

async function main(
) {
    const owners = await ethers.getSigners()
    let owner : SignerWithAddress = owners[0]
    let other : SignerWithAddress = owners[1]
    console.log("owner : ", owner.address, " balance : ", await owner.getBalance())

    if (process.env.ONLY_DEPLOY_NFT) {
        await deploy_nft(owner)
        exit(0)
    }

    if (process.env.ONLY_UPGRADE) {
        await upgrade(owner)
        exit(0)
    }

    const v : Vote = await deploy(owner)
    if (process.env.ONLY_DEPLOY) {
        exit(0)
    }


    // 1/3. create group
    enum PRIVACY {
        ANYONE,     // any one can join
        NFT,        // could join group if owner of a NFT
        TOKEN       // could join group if owner of token
    }

    const vnft : VoteNFT = await deploy_nft(owner)
    expect(await vnft.balanceOf(owner.address)).equal(0)

    await (await (v.CreateGroupWithAssetDemand(
        TREE_DEPTH, 
        owner.address,
        "relationship",
        "relationship",
        PRIVACY.NFT,
        "https://cdn.stamp.fyi/space/sexxdao.eth?s=160&cb=3eedf008c0dab2e3",
        vnft.address
    ))).wait()
    const groupId = await v.GROUP_ID()
    console.log("create Group Id : ", groupId)

    // 2/3. add Member
    const identity = new Identity("identity")
    const identityCommitment = identity.getCommitment()

    // const ov = v.connect(other) as Vote
    // try {
    //     await (await (ov.addMember(groupId, identityCommitment))).wait()
    // } catch (error) {
    //     expect(error.toString().includes(REVERT_REASON_ONLY_ADMIN)).equal(true)
    // }
    
    try {
        await (await (v.addMember(groupId, identityCommitment))).wait()
    } catch (error) {
        expect(error.toString().includes(REVERT_REASON_MISS_NFT)).equal(true)
    }

    await (await vnft.mint()).wait()
    expect(await vnft.balanceOf(owner.address)).equal(1)
    expect(await vnft.ownerOf(0)).equal(owner.address)
    await (await (v.addMember(groupId, identityCommitment))).wait()

    try {
        await (await (v.addMember(groupId, identityCommitment))).wait()
    } catch (error) {
        expect(error.toString().includes(REVERT_REASON_ID_EXIST_IN_GROUP)).equal(true)
    }

    // 3/3. generate witness, prove, verify
    const group = new Group(TREE_DEPTH)
    group.addMembers([identityCommitment])

    // same r/rc
    const rand : bigint = BigNumber.from(123456).toBigInt()
    const rc = poseidon([rand, identity.getNullifier()])

    const groupProof =  await generateGroupProof(
        identity,
        group,
        rand,
        get_circuit_wasm_file("group"),
        get_circuit_zkey_file("group").growth16
    )
    console.log("groupProof : ", groupProof)

    let solidityGroupProof: SolidityProof = packToSolidityProof(groupProof.proof)

    const msg = "brazil"

    const pollId = await v.groupPollNum(groupId)
    const externalNullifier = BigNumber.from(groupId.shl(128).add(pollId))
    console.log("externalNullifier : ", externalNullifier)
    await (await v.createPollInGroup(
        groupId,
        ['brazil', 'france', 'others'],
        "world cup 2022",
        "your favourite team for world cup 2022"
    )).wait()
    console.log("Create Pool : ", await v.groupPolls(groupId, pollId))

    const filter = v.filters.PollAdded(groupId, null, null)
    const events = await v.queryFilter(filter)
    console.log("events : ", events[0].args)


    const msgHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["string"],
            [msg]
        )
    )
    const signalProof =  await generateSignalProof(
        identity,
        rand,
        externalNullifier.toBigInt(),
        msgHash,
        get_circuit_wasm_file("signal"),
        get_circuit_zkey_file("signal")
    )
    let soliditySignalProof: SolidityProof = packToSolidityProof(signalProof.proof)
    console.log("signalProof : ", signalProof)

    // const gas = await v.estimateGas.vote(
    //     rc, groupId, solidityGroupProof,
    //     bytes32msg,
    //     signalProof.publicSignals.nullifierHash,
    //     externalNullifier,
    //     soliditySignalProof
    // )

    const recipt = await (await v.voteInPoll(
        rc, groupId, solidityGroupProof,
        pollId,
        msg,
        signalProof.publicSignals.nullifierHash,
        soliditySignalProof
    )).wait()

    try {
        await (await v.voteInPoll(
            rc, groupId, solidityGroupProof,
            pollId,
            msg,
            signalProof.publicSignals.nullifierHash,
            soliditySignalProof
        )).wait()
    } catch (error) {
        expect(error.toString().includes(REVERT_REASON_ALREADY_SIGNAL)).equal(true)
    }

    console.log("recipt.transactionHash : ", recipt.transactionHash)
    console.log("pollVoteStat[msg] = ", await v.pollVoteStat(groupId, pollId, msg))
    console.log("Voting Done!!!")
}

async function _upgrade(
    PROXY_ADDR : string,
    cf : ContractFactory
) {
    let old_target = await upgrades.erc1967.getImplementationAddress(PROXY_ADDR)
    const c = await upgrades.upgradeProxy(PROXY_ADDR, cf)
    await c.deployed()

    let new_target = await upgrades.erc1967.getImplementationAddress(PROXY_ADDR)
    let upgrade_flag = "\n# ++++++ upgrade " + hre.hardhatArguments.network + " on " + new Date().toUTCString() + " ++++++++++++"
    fs.appendFileSync('.env', upgrade_flag)
    if (old_target.toLowerCase() != new_target.toLowerCase()) {
	    writeToEnv("# PROXY " + PROXY_ADDR + " NEW_TARGET", new_target)
        await verify(new_target)
    }
}

async function upgrade(
    owner : SignerWithAddress
) {
    const GROUP_VERIFIER_PROXY_ADDR = process.env.GROUP_VERIFIER
    const GROUP_PROXY_ADDR = process.env.GROUP
    const SIGNAL_VERIFIER_PROXY_ADDR = process.env.SIGNAL_VERIFIER
    const SIGNAL_PROXY_ADDR = process.env.SIGNAL
    const VOTE_PROXY_ADDR = process.env.VOTE

    await _upgrade(VOTE_PROXY_ADDR, new Vote__factory(owner))
}

main()
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});

