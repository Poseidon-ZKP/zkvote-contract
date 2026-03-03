import { ethers } from "hardhat";
import * as fs from "fs";

/**
 * Fix: Exclude loader + retry loadLiquidity.
 *
 * The loader was deployed but NOT excluded from token restrictions.
 * loadLiquidity reverted because the token's sidepool prevention
 * blocked the PoolManager interaction.
 *
 * Tokens (1B) are still in the loader (the revert refunded the state).
 * 0.5 ETH was lost to gas, but deployer still has ~0.4 ETH.
 */

const TOKEN_ADDRESS = "0xe8001DC781B66D5ccb189AC0429978fc48c6cf5E";
const HOOK_DEPLOYER_ADDRESS = "0x863D92cF9769349A1c72fb9007981463BFA8e642";
const HOOK_ADDRESS = "0xe02B0b5739E7C64f41d3295c191635E680bE40C4";
const LOADER_ADDRESS = "0x9C0f9f541C49d454c8C7403816D05eD6aA3FAC37";
const HOOK_SALT = "0x0000000000000000000000000000000000000000000000000000000000002c9a";

const V4_POOL_MANAGER = "0x000000000004444c5dc75cB358380D2e3dE08A90";
const V4_POSITION_MANAGER = "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const VERIFIER = "0xf93cd08E0D8e5465ec7Fa1E8b46362911C5CB691";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n════════════════════════════════════════════════════════");
  console.log("  FIX: Exclude loader + retry loadLiquidity");
  console.log("════════════════════════════════════════════════════════\n");

  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const token = await ethers.getContractAt("TuringToken", TOKEN_ADDRESS);

  // Check current state
  console.log("\nCurrent state:");
  console.log("  token.hook():", await token.hook());
  console.log("  token.poolManager():", await token.poolManager());
  console.log("  Loader excluded:", await token.isExcluded(LOADER_ADDRESS));
  console.log("  Loader TURING:", ethers.formatEther(await token.balanceOf(LOADER_ADDRESS)));
  console.log("  Deployer TURING:", ethers.formatEther(await token.balanceOf(deployer.address)));

  // ═══════════════════════════════════════════════════════════════
  //  FIX: Exclude loader from token restrictions
  // ═══════════════════════════════════════════════════════════════

  const isExcluded = await token.isExcluded(LOADER_ADDRESS);
  if (!isExcluded) {
    console.log("\nExcluding loader from token restrictions...");
    const txExclude = await token.setExcluded(LOADER_ADDRESS, true);
    console.log("   Tx:", txExclude.hash);
    await txExclude.wait();
    console.log("   Excluded:", await token.isExcluded(LOADER_ADDRESS));
  } else {
    console.log("\nLoader already excluded");
  }

  // ═══════════════════════════════════════════════════════════════
  //  RETRY: Load liquidity with 0.5 ETH
  // ═══════════════════════════════════════════════════════════════

  console.log("\nLoading liquidity (0.5 ETH)...");
  const loader = await ethers.getContractAt("TuringLiquidityLoaderV4", LOADER_ADDRESS);
  const tx8 = await loader.loadLiquidity(HOOK_ADDRESS, {
    value: ethers.parseEther("0.5"),
    gasLimit: 5_000_000,
  });
  console.log("   Tx:", tx8.hash);
  console.log("   Waiting...");
  await tx8.wait();
  console.log("   Done!");

  // ═══════════════════════════════════════════════════════════════
  //  Verify
  // ═══════════════════════════════════════════════════════════════

  console.log("\nFinal verification...");
  console.log("   token.hook():", await token.hook());
  console.log("   token.poolManager():", await token.poolManager());

  const hookContract = await ethers.getContractAt("TuringHook", HOOK_ADDRESS);
  const hookOwner = await hookContract.owner();
  console.log("   Hook owner:", hookOwner);
  console.log("   Owner is EOA:", hookOwner.toLowerCase() === deployer.address.toLowerCase());
  console.log("   Loader remaining:", ethers.formatEther(await token.balanceOf(LOADER_ADDRESS)));
  console.log("   Deployer remaining:", ethers.formatEther(await token.balanceOf(deployer.address)));

  // Save
  const deployment = {
    timestamp: new Date().toISOString(),
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    turingToken: TOKEN_ADDRESS,
    turingHook: HOOK_ADDRESS,
    hookDeployer: HOOK_DEPLOYER_ADDRESS,
    liquidityLoader: LOADER_ADDRESS,
    poolManager: V4_POOL_MANAGER,
    positionManager: V4_POSITION_MANAGER,
    permit2: PERMIT2,
    verifier: VERIFIER,
    salt: HOOK_SALT,
    requiredFlags: "0xc4",
    liquidityTxHash: tx8.hash,
    poolKey: {
      currency0: "0x0000000000000000000000000000000000000000",
      currency1: TOKEN_ADDRESS,
      fee: 0,
      tickSpacing: 10,
      hooks: HOOK_ADDRESS,
    },
    sqrtPriceX96: "79228162514264337593543950336000",
    tickLower: -887270,
    tickUpper: 138170,
    priceDescription: "1M TURING per ETH",
  };

  if (!fs.existsSync("./deployments")) fs.mkdirSync("./deployments", { recursive: true });
  const filename = `./deployments/full-deploy-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
  console.log("\n   Saved to:", filename);

  console.log("\n════════════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("════════════════════════════════════════════════════════");
  console.log("  TuringToken:     ", TOKEN_ADDRESS);
  console.log("  TuringHook:      ", HOOK_ADDRESS);
  console.log("  HookDeployer:    ", HOOK_DEPLOYER_ADDRESS);
  console.log("  LiquidityLoader: ", LOADER_ADDRESS);
  console.log("  Hook owner:      ", hookOwner);
  console.log("════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
