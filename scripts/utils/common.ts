import { ethers } from "hardhat" 

import * as fs from 'fs';

const hre = require('hardhat');
export function is_hardhat_local_network() {
	return hre.hardhatArguments.network == undefined ||
		   hre.hardhatArguments.network == "localhost" ||
		   hre.hardhatArguments.network == "ganache" ||
		   hre.hardhatArguments.network == "hardhat"

}

export function writeToEnv(name:string, value:string) {
	if (is_hardhat_local_network()) {
		name = "TEST_" + name
	}
	console.log(name, " : ", value)
    let str = "\n" + name + " = " + value
    fs.appendFileSync('.env', str)
	process.env[name] = value
}

export function readEnv(name:string) {
	if (is_hardhat_local_network()) {
		name = "TEST_" + name
	}
	return process.env[name]
}

export function sleep(ms) {
	console.log("sleep ", ms, " ms")
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function deepCopy(obj) {
	return Object.assign(Object.create(Object.getPrototypeOf(obj)), obj)
}

export function generateL2PrivKey(l1_priv_key) {
	return ethers.utils.sha256(l1_priv_key)
}

export function generateL2PubKey(l1_priv_key) {
	const l2_priv_key = generateL2PrivKey(l1_priv_key)
	return ethers.utils.computePublicKey(l2_priv_key, true).slice(0,20)
}


export function packPubData(data, size) : string {
	let pubData = ethers.utils.hexlify("0x");
	data.forEach((val, idx, array) => {
		pubData = ethers.utils.hexConcat(
    		[	ethers.utils.hexlify(pubData),
        		ethers.utils.hexZeroPad(
          			ethers.utils.hexlify(val), 
					size[idx])
      		])
  	});
  	return pubData
}


//import clipboard from 'clipboardy'
// code from js/zkp-contract/node_modules/clipboardy/lib/macos.js
import execa from 'execa';
const env = {
	LC_CTYPE: 'UTF-8',
};
export const clipboard = {
	copy: async options => execa('pbcopy', {...options, env}),
	paste: async options => {
		const {stdout} = await execa('pbpaste', {...options, env});
		return stdout;
	},
	copySync: options => execa.sync('pbcopy', {...options, env}),
	pasteSync: options => execa.sync('pbpaste', {...options, env}).stdout,
};

async function waitEtherscan(addr: string) {

	// wait deploy contract ready on chain
	while(1) {
	  const code = await ethers.provider.getCode(addr)
	  if (code.length > 2) {
		break
	  } else {
		console.log("waiting ")
		await utils.common.sleep(10000)
	  }
	}
}

export async function verify(addr: string) {
	if (!is_hardhat_local_network()) {
		await waitEtherscan(addr)
		try {
			await hre.run('verify', {address : addr});
		} catch (e) {
			console.error(e);
		}
	}
}

export async function verify2(addr: string, args) {
	if (typeof hre.hardhatArguments.network != "undefined") {
		await waitEtherscan(addr)
		try {
			// await hre.run('verify:verify', {address : addr, constructorArguments : args});
			await hre.run('verify', {address : addr, constructorArguments : args});
		} catch (e) {
			console.error(e);
		}
	}
}