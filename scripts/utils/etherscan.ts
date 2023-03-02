import axios  from "axios"
import * as fs from 'fs';

import { ethers, upgrades } from "hardhat" 
import path from "path";
import { exit } from "process";

const hre = require('hardhat');

export async function dnld_etherscan_contract_source_code(
	contractAddress : string,
	DIR : string
) {
	const url = "https://api.etherscan.io/api"
	let resp

	await axios.get(url, {
		params : {
			module : "contract",
			action : "getsourcecode",
			address : contractAddress,
			apiKey : hre.config.etherscan.apiKey
		}
	}).then(function (response) {
		resp = response
		// handle success
		console.log("response.data.status: ", response.data.status);
		console.log("response.data.message: ", response.data.message);
		console.log("response.data.result[0].CompilerVersion: ", response.data.result[0].CompilerVersion);
		console.log("response.data.result[0].ConstructorArguments: ", response.data.result[0].ConstructorArguments);
		// console.log(response.data.result[0].ABI)

		let codes = JSON.parse(response.data.result[0].SourceCode.slice(1, -1)).sources
		//console.log("codes ", codes)
		for (const key of Object.keys(codes)) {
			console.log("......write ", DIR+key)
			fs.mkdirSync(path.dirname(DIR+key), { recursive: true })
			fs.writeFileSync(DIR+key, codes[key].content)
		}

	})
	.catch(function (error) {
		console.log(error);
		//console.log(JSON.parse(resp.data.result[0].SourceCode))

		let str : String = resp.data.result[0].SourceCode
		// console.log(str.slice(1, -1))
	})
	.then(function () {
		console.log("executed")
	});
} 


if (process.env.ETHERSCAN_UNIT_TEST) {

	describe("Etherscan Unit Test", function() {
		this.timeout(6000000);
		let owner

		before(async () => {
			const owners = await ethers.getSigners()
			owner = owners[0]
			console.log('signer : ', owner.address)

		});

		it("Etherscan Download Source Code", async function() {
			const DIR = "/Users/huxinming/perpetual/camp/zk-money-bot/contracts/zk-money/"
			const contractAddress = "0x3f972e325CecD99a6be267fd36ceB46DCa7C3F28"
			await dnld_etherscan_contract_source_code(contractAddress, DIR)
		});

	});
}