import * as snarkjs from "snarkjs"
import { execSync } from "child_process";

import * as ffjavascript from "ffjavascript";

import * as r1csfile from "r1csfile";
import * as blakejs from "blakejs";
import * as fs from "fs";

import log4js from "log4js"
import { exit } from "process";
export const logger = log4js.getLogger();
logger.level = "debug";
logger.debug("log4js level debug");

export const TREE_DEPTH = 10 // 10 need 43s ,  16 need 10mins, 20need ~ 160mins
export const REVERT_REASON_HEADER = "VM Exception while processing transaction: reverted with reason string "
export const REVERT_REASON_ID_EXIST_IN_GROUP = REVERT_REASON_HEADER + "\'" + "id exist in group!" + "\'"
export const REVERT_REASON_ONLY_ADMIN = REVERT_REASON_HEADER + "\'" + "only Admin!" + "\'"
export const REVERT_REASON_MISS_NFT = REVERT_REASON_HEADER + "\'" + "missing nft!" + "\'"
export const REVERT_REASON_ALREADY_SIGNAL = REVERT_REASON_HEADER + "\'" + "already signal" + "\'"

export async function compile_circom (fileName, options) {    
    var flags = "--wasm ";
    // flags += "--inspect ";
    if (options.sym) flags += "--sym ";
    if (options.r1cs) flags += "--r1cs ";
    if (options.json) flags += "--json ";
    if (options.output) flags += "--output " + options.output + " ";
    if (options.O === 0) flags += "--O0 "		// no simplify
    if (options.O === 1) flags += "--O1 "		// only apply var-to-var/var-to-const simplify
    if (options.O === 2) flags += "--O2 "		// full constraint simplify

	try {
    	await execSync("./submodules/circom/target/release/circom "  + flags + fileName);
    	console.log("compile circom circuit done !")
	} catch (error) {
		console.log("error : ", error)
		console.log("error.stdout : ", error.stdout.toString())
		exit(-1)
	}
}

export async function generate_ptau_fina_key(
    curve,
    FILE_PTAU_FINAL
) {
		const ptau_0 = {type: "mem"};
    	const ptau_1 = {type: "mem"};
    	const ptau_2 = {type: "mem"};
    	const ptau_beacon = {type: "mem"};
    	const ptau_challenge2 = {type: "mem"};
    	const ptau_response2 = {type: "mem"};
        const ptau_final = {type: "mem", data: undefined};
        console.log(new Date().toUTCString() + " ptau start...")
        await snarkjs.powersOfTau.newAccumulator(curve, TREE_DEPTH, ptau_0);
        await snarkjs.powersOfTau.contribute(ptau_0, ptau_1, "C1", "Entropy1");
        await snarkjs.powersOfTau.exportChallenge(ptau_1, ptau_challenge2);
        await snarkjs.powersOfTau.challengeContribute(curve, ptau_challenge2, ptau_response2, "Entropy2");
        await snarkjs.powersOfTau.importResponse(ptau_1, ptau_response2, ptau_2, "C2", true);
        await snarkjs.powersOfTau.beacon(ptau_2, ptau_beacon, "B3", "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20", 10);
        await snarkjs.powersOfTau.preparePhase2(ptau_beacon, ptau_final);
		fs.writeFileSync(FILE_PTAU_FINAL, Buffer.from(ptau_final.data))
        console.log(new Date().toUTCString() + " ptau generated...")
}

export async function generate_zkey_final_key(
    curve,
    ptau_final,
    FILE_R1CS,
    FILE_ZKEY_FINAL
) {
	
	const zkey_0 = {type: "mem"};
	const zkey_1 = {type: "mem"};
	const zkey_2 = {type: "mem"};
	const bellman_1 = {type: "mem"};
	const bellman_2 = {type: "mem"};
    const zkey_final = {type: "mem", data : undefined};
    console.log(new Date().toUTCString() + " zkey start...")
	await snarkjs.zKey.newZKey(FILE_R1CS, ptau_final, zkey_0, logger);
	await snarkjs.zKey.contribute(zkey_0, zkey_1, "p2_C1", "pa_Entropy1");
	await snarkjs.zKey.exportBellman(zkey_1, bellman_1);
	await snarkjs.zKey.bellmanContribute(curve, bellman_1, bellman_2, "pa_Entropy2");
	await snarkjs.zKey.importBellman(zkey_1, bellman_2, zkey_2, "C2");
	await snarkjs.zKey.beacon(zkey_2, zkey_final, "B3", "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20", 10);
	let res = await snarkjs.zKey.verifyFromR1cs(FILE_R1CS, ptau_final, zkey_final);
	res = await snarkjs.zKey.verifyFromInit(zkey_0, ptau_final, zkey_final);
	fs.writeFileSync(FILE_ZKEY_FINAL, Buffer.from(zkey_final.data))
    console.log(new Date().toUTCString() + " zkey generated...")
}

export function get_circuit_wasm_file(
    CUR_CIRCUIT : string
) {
    const DIR = process.cwd()
    console.log("WORK DIR : ", DIR)
    const CIRCUIT_TGT_DIR = DIR + "/circuits/" + CUR_CIRCUIT + "/"
    const wasmFilePath = CIRCUIT_TGT_DIR + CUR_CIRCUIT + "_js/" + CUR_CIRCUIT + ".wasm"
    return wasmFilePath
}

export function get_circuit_zkey_file(
    CUR_CIRCUIT : string
) {
    const DIR = process.cwd()
    console.log("WORK DIR : ", DIR)
    const CIRCUIT_TGT_DIR = DIR + "/circuits/" + CUR_CIRCUIT + "/"
    const FILE_ZKEY_FINAL = CIRCUIT_TGT_DIR + "zkey.16"
    const FILE_ZKEY_PLONK = CIRCUIT_TGT_DIR + "zkey.plonk.16"
    return {
        growth16 : FILE_ZKEY_FINAL,
        plonk : FILE_ZKEY_PLONK
    }
}

export async function build_circuit(
    CUR_CIRCUIT : string
) {
    const DIR = process.cwd()
    console.log("WORK DIR : ", DIR)
    const CIRCUIT_TGT_DIR = DIR + "/circuits/" + CUR_CIRCUIT + "/"
	await compile_circom(CIRCUIT_TGT_DIR + CUR_CIRCUIT + ".circom", {
		sym : true,
		r1cs : true,
		json : true,
		O : 1,
		output : CIRCUIT_TGT_DIR
	})

    const FILE_R1CS = CIRCUIT_TGT_DIR + CUR_CIRCUIT + ".r1cs"
    const FILE_PTAU_FINAL = DIR + "/circuits/ptau.16"
    const FILE_ZKEY_FINAL = CIRCUIT_TGT_DIR + "zkey.16"

    const ptau_final = {type: "mem", data: undefined};
    const zkey_final = {type: "mem", data : undefined};

    const curve = await ffjavascript.getCurveFromName("bn128");
	console.log("curve.q : ", curve.q)
	if (process.env.NEW_PTAU_FINAL_KEY) {
        // Trust setup : need long time depand on circuit power
		await generate_ptau_fina_key(curve, FILE_PTAU_FINAL)
	}
	let ptau_data = Buffer.from(fs.readFileSync(FILE_PTAU_FINAL))
	ptau_final.data = new Uint8Array(ptau_data)

	await generate_zkey_final_key(curve, ptau_final, FILE_R1CS, FILE_ZKEY_FINAL)
	let zkey_data = Buffer.from(fs.readFileSync(FILE_ZKEY_FINAL))
	zkey_final.data = new Uint8Array(zkey_data)

    // export/generate on-chain verifier
	const templates = {groth16 : undefined}
	templates.groth16 = await fs.promises.readFile(DIR + "/snarkjs-templates/verifier_groth16.sol.ejs", "utf8");
	let verifierCode : string = await snarkjs.zKey.exportSolidityVerifier(zkey_final, templates)
	verifierCode = verifierCode.replace("Verifier", CUR_CIRCUIT + "Verifier")
	verifierCode = verifierCode.replace(new RegExp("Pairing", "g"), CUR_CIRCUIT + "Pairing")
	fs.writeFileSync(DIR + "/contracts/" + CUR_CIRCUIT + "/" + CUR_CIRCUIT + "_verifier.sol", verifierCode, "utf-8");

    // Plonk
    const zkey_plonk = {type: "mem", data : undefined};
    const FILE_ZKEY_PLONK = CIRCUIT_TGT_DIR + "zkey.plonk.16"
    await snarkjs.plonk.setup(FILE_R1CS, ptau_final, zkey_plonk);
	fs.writeFileSync(FILE_ZKEY_PLONK, Buffer.from(zkey_plonk.data))
    console.log(new Date().toUTCString() + " zkey plonk generated...")
    const plonk_templates = {plonk : undefined}
	plonk_templates.plonk = await fs.promises.readFile(DIR + "/snarkjs-templates/verifier_plonk.sol.ejs", "utf8");
	verifierCode = await snarkjs.zKey.exportSolidityVerifier(zkey_plonk, plonk_templates)
	verifierCode = verifierCode.replace("PlonkVerifier", CUR_CIRCUIT + "PlonkVerifier")
	fs.writeFileSync(DIR + "/contracts/" + CUR_CIRCUIT + "/" + CUR_CIRCUIT + "_plonk_verifier.sol", verifierCode, "utf-8");

}