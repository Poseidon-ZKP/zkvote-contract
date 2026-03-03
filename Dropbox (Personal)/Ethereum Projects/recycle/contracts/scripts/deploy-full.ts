import { ethers } from "hardhat";
import * as fs from "fs";

/**
 * Full Redeployment: TuringToken + TuringHook V2 + Liquidity
 *
 * Deploys everything fresh to fix 3 critical bugs:
 * 1. Hook afterSwap used team.call{value:} (no ETH in flash accounting) + returned wrong sign
 * 2. tickUpper=138150 < currentTick=138162 → 0 active liquidity
 * 3. Hook owner was deployer contract (Ownable(msg.sender) in constructor)
 *
 * Steps:
 * 1. Deploy new TuringToken
 * 2. Deploy TuringHookDeployer
 * 3. Mine valid CREATE2 salt (flags: 0xC4)
 * 4. Deploy TuringHook via CREATE2 (owner = deployer EOA)
 * 5. Configure token: setHook + setPoolManager
 * 6. Deploy TuringLiquidityLoaderV4
 * 7. Transfer 1B TURING to loader
 * 8. Load liquidity with 0.5 ETH
 * 9. Verify deployment
 * 10. Save addresses
 */

// ═══════════════════════════════════════════════════════════════
//                     INFRASTRUCTURE ADDRESSES
// ═══════════════════════════════════════════════════════════════

const V4_POOL_MANAGER = "0x000000000004444c5dc75cB358380D2e3dE08A90";
const V4_POSITION_MANAGER = "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const VERIFIER = "0xf93cd08E0D8e5465ec7Fa1E8b46362911C5CB691";

// V4 mainnet hook permission bits:
//   beforeSwap (bit 7) + afterSwap (bit 6) + afterSwapReturnDelta (bit 2)
const REQUIRED_FLAGS = (1 << 7) | (1 << 6) | (1 << 2); // 0xC4 = 196

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n════════════════════════════════════════════════════════");
  console.log("  FULL REDEPLOYMENT: TuringToken + TuringHook V2 + LP");
  console.log("════════════════════════════════════════════════════════\n");

  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.6")) {
    console.error("\nInsufficient ETH. Need ~0.6 ETH (0.5 for LP + gas).");
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════
  //  STEP 1: Deploy new TuringToken
  // ═══════════════════════════════════════════════════════════════

  console.log("\n1. Deploying new TuringToken...");
  const TuringToken = await ethers.getContractFactory("TuringToken");
  const token = await TuringToken.deploy(
    "Turing",
    "TURING",
    ethers.parseEther("1000000000"), // 1B tokens
    VERIFIER,
    deployer.address // team wallet = deployer
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("   TuringToken:", tokenAddress);
  console.log("   Supply:", ethers.formatEther(await token.totalSupply()));

  // ═══════════════════════════════════════════════════════════════
  //  STEP 2: Deploy TuringHookDeployer
  // ═══════════════════════════════════════════════════════════════

  console.log("\n2. Deploying TuringHookDeployer...");
  const HookDeployer = await ethers.getContractFactory("TuringHookDeployer");
  const hookDeployer = await HookDeployer.deploy();
  await hookDeployer.waitForDeployment();
  const hookDeployerAddress = await hookDeployer.getAddress();
  console.log("   TuringHookDeployer:", hookDeployerAddress);

  // ═══════════════════════════════════════════════════════════════
  //  STEP 3: Mine valid CREATE2 salt
  // ═══════════════════════════════════════════════════════════════

  console.log("\n3. Mining salt for valid hook address...");
  console.log("   Required flags: 0x" + REQUIRED_FLAGS.toString(16), "(bits 7, 6, 2)");
  console.log("   Owner (included in bytecode hash):", deployer.address);
  console.log("   50,000 salts per batch, up to 200 batches...");

  let validSalt: string | null = null;
  let validAddress: string | null = null;
  const MAX_BATCHES = 200;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const startNonce = batch * 50000;
    if (batch % 10 === 0) {
      console.log(`   Batch ${batch + 1}/${MAX_BATCHES} (nonces ${startNonce}-${startNonce + 49999})...`);
    }

    try {
      const [salt, addr] = await hookDeployer.mineSalt(
        V4_POOL_MANAGER,
        tokenAddress,
        deployer.address, // owner parameter
        startNonce
      );
      validSalt = salt;
      validAddress = addr;
      break;
    } catch {
      // No valid salt in this range, continue
    }
  }

  if (!validSalt || !validAddress) {
    console.error("\nFailed to find valid salt after", MAX_BATCHES * 50000, "attempts");
    process.exit(1);
  }

  console.log("   Found valid salt!");
  console.log("   Salt:", validSalt);
  console.log("   Predicted address:", validAddress);

  // Verify flags
  const addrInt = BigInt(validAddress);
  const flagsMatch = (addrInt & BigInt(REQUIRED_FLAGS)) === BigInt(REQUIRED_FLAGS);
  const extraBits = addrInt & BigInt((1 << 14) - 1) & ~BigInt(REQUIRED_FLAGS);
  console.log("   Required flags set:", flagsMatch ? "YES" : "NO");
  console.log("   No extra flag bits:", extraBits === 0n ? "YES" : "NO");

  if (!flagsMatch || extraBits !== 0n) {
    console.error("   Address flag validation failed!");
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════
  //  STEP 4: Deploy TuringHook via CREATE2
  // ═══════════════════════════════════════════════════════════════

  console.log("\n4. Deploying TuringHook with CREATE2...");
  const txHookDeploy = await hookDeployer.deployHook(
    V4_POOL_MANAGER,
    tokenAddress,
    validSalt
  );
  const receiptHook = await txHookDeploy.wait();
  console.log("   TuringHook deployed at:", validAddress);
  console.log("   Gas used:", receiptHook?.gasUsed.toString());

  // ═══════════════════════════════════════════════════════════════
  //  STEP 5: Configure TuringToken
  // ═══════════════════════════════════════════════════════════════

  console.log("\n5. Configuring TuringToken...");

  // setHook — also auto-excludes hook from decay/restrictions
  console.log("   Setting hook address...");
  const txSetHook = await token.setHook(validAddress);
  await txSetHook.wait();
  console.log("   token.hook() =", await token.hook());

  // setPoolManager
  console.log("   Setting PoolManager...");
  const txSetPM = await token.setPoolManager(V4_POOL_MANAGER);
  await txSetPM.wait();
  console.log("   token.poolManager() =", await token.poolManager());

  // ═══════════════════════════════════════════════════════════════
  //  STEP 6: Deploy TuringLiquidityLoaderV4
  // ═══════════════════════════════════════════════════════════════

  console.log("\n6. Deploying TuringLiquidityLoaderV4...");
  const Loader = await ethers.getContractFactory("TuringLiquidityLoaderV4");
  const loader = await Loader.deploy(V4_POSITION_MANAGER, PERMIT2, tokenAddress);
  await loader.waitForDeployment();
  const loaderAddress = await loader.getAddress();
  console.log("   Loader:", loaderAddress);

  // Exclude loader from token restrictions
  console.log("   Excluding loader from restrictions...");
  const txExclude = await token.setExcluded(loaderAddress, true);
  await txExclude.wait();
  console.log("   Excluded:", await token.isExcluded(loaderAddress));

  // ═══════════════════════════════════════════════════════════════
  //  STEP 7: Transfer 1B TURING to loader
  // ═══════════════════════════════════════════════════════════════

  console.log("\n7. Transferring 1B TURING to loader...");
  const deployerTokenBal = await token.balanceOf(deployer.address);
  const txTransfer = await token.transfer(loaderAddress, deployerTokenBal);
  await txTransfer.wait();
  console.log("   Loader balance:", ethers.formatEther(await token.balanceOf(loaderAddress)));

  // ═══════════════════════════════════════════════════════════════
  //  STEP 8: Load liquidity with 0.5 ETH
  // ═══════════════════════════════════════════════════════════════

  console.log("\n8. Loading liquidity (0.5 ETH)...");
  const loaderContract = await ethers.getContractAt("TuringLiquidityLoaderV4", loaderAddress);
  const txLoad = await loaderContract.loadLiquidity(validAddress, {
    value: ethers.parseEther("0.5"),
    gasLimit: 5_000_000,
  });
  console.log("   Tx:", txLoad.hash);
  console.log("   Waiting for confirmation...");
  const receiptLoad = await txLoad.wait();
  console.log("   Gas used:", receiptLoad?.gasUsed.toString());

  // ═══════════════════════════════════════════════════════════════
  //  STEP 9: Verify deployment
  // ═══════════════════════════════════════════════════════════════

  console.log("\n9. Verifying deployment...");

  // Token config
  const hookAddr = await token.hook();
  const pmAddr = await token.poolManager();
  console.log("   token.hook():", hookAddr);
  console.log("   token.poolManager():", pmAddr);
  console.log("   Hook matches:", hookAddr.toLowerCase() === validAddress!.toLowerCase() ? "YES" : "NO");
  console.log("   PM matches:", pmAddr.toLowerCase() === V4_POOL_MANAGER.toLowerCase() ? "YES" : "NO");

  // Hook owner
  const hookContract = await ethers.getContractAt("TuringHook", validAddress!);
  const hookOwner = await hookContract.owner();
  console.log("   Hook owner:", hookOwner);
  console.log("   Owner is EOA:", hookOwner.toLowerCase() === deployer.address.toLowerCase() ? "YES" : "NO");

  // Remaining balances
  console.log("   Loader remaining tokens:", ethers.formatEther(await token.balanceOf(loaderAddress)));
  console.log("   Deployer remaining tokens:", ethers.formatEther(await token.balanceOf(deployer.address)));

  // ═══════════════════════════════════════════════════════════════
  //  STEP 10: Save deployment info
  // ═══════════════════════════════════════════════════════════════

  const deployment = {
    timestamp: new Date().toISOString(),
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    turingToken: tokenAddress,
    turingHook: validAddress,
    hookDeployer: hookDeployerAddress,
    liquidityLoader: loaderAddress,
    poolManager: V4_POOL_MANAGER,
    positionManager: V4_POSITION_MANAGER,
    permit2: PERMIT2,
    verifier: VERIFIER,
    salt: validSalt,
    requiredFlags: "0x" + REQUIRED_FLAGS.toString(16),
    hookGasUsed: receiptHook?.gasUsed.toString(),
    liquidityGasUsed: receiptLoad?.gasUsed.toString(),
    liquidityTxHash: txLoad.hash,
    poolKey: {
      currency0: "0x0000000000000000000000000000000000000000",
      currency1: tokenAddress,
      fee: 0,
      tickSpacing: 10,
      hooks: validAddress,
    },
    sqrtPriceX96: "79228162514264337593543950336000",
    tickLower: -887270,
    tickUpper: 138170,
    priceDescription: "1M TURING per ETH",
  };

  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments", { recursive: true });
  }
  const filename = `./deployments/full-deploy-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
  console.log("\n   Deployment saved to:", filename);

  // ═══════════════════════════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════════════════════════

  console.log("\n════════════════════════════════════════════════════════");
  console.log("  FULL DEPLOYMENT COMPLETE");
  console.log("════════════════════════════════════════════════════════");
  console.log("  TuringToken:     ", tokenAddress);
  console.log("  TuringHook:      ", validAddress);
  console.log("  HookDeployer:    ", hookDeployerAddress);
  console.log("  LiquidityLoader: ", loaderAddress);
  console.log("");
  console.log("  Hook owner:      ", hookOwner);
  console.log("  token.hook():    ", hookAddr);
  console.log("  token.poolManager():", pmAddr);
  console.log("");
  console.log("  NEXT STEPS:");
  console.log("  1. Verify contracts on Etherscan");
  console.log("  2. Update frontend/src/lib/contracts.ts: TURING_TOKEN_ADDRESS =", `'${tokenAddress}'`);
  console.log("  3. Update frontend/src/pages/SwapPage.tsx: TURING_TOKEN + HOOK constants");
  console.log("  4. Update frontend/src/pages/HomePage.tsx: TURING_TOKEN constant");
  console.log("  5. cd frontend && npm run build");
  console.log("  6. Deploy frontend to labs/turing/");
  console.log("  7. Test swap on website + Uniswap frontend");
  console.log("  8. Block old V2/V3 sidepool addresses");
  console.log("════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
