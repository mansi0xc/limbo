import { encodeFunctionData, parseEther, parseGwei, type Hex } from "viem";
import { config } from "./config.js";
import { deployContract, getCodeHash, getStake, loadArtifact } from "./contracts.js";
import { sendLegacy } from "./chain.js";
import { getBalance, waitMined } from "./rpc.js";
import { addressOf, ensureKey, writeState } from "./state.js";

async function sendAndWait(key: Hex, tx: Parameters<typeof sendLegacy>[1]): Promise<Hex> {
  const hash = await sendLegacy(key, tx);
  const receipt = await waitMined(hash);
  if (receipt.status !== "0x1") throw new Error(`transaction ${hash} reverted`);
  return hash;
}

async function main(): Promise<void> {
  const deployerKey = ensureKey("deployer");
  const makerKey = ensureKey("maker");
  const deployer = addressOf(deployerKey);
  const maker = addressOf(makerKey);

  const balance = await getBalance(deployer);
  if (balance < parseEther("0.2")) {
    throw new Error(`deployer ${deployer} has ${balance} wei; fund it before yarn deploy:pred`);
  }

  await sendAndWait(deployerKey, { to: maker, value: parseEther("0.05"), gas: 100_000n });

  const quoteToken = await deployContract("TestToken", [parseEther("1000000")], 0n, deployerKey);
  const quoteBook = await deployContract(
    "QuoteBook",
    [
      maker,
      quoteToken,
      config.stakingRegistry,
      parseEther("0.001"),
      parseGwei("1"),
      parseGwei("2"),
      500_000n,
    ],
    0n,
    deployerKey
  );

  await sendAndWait(deployerKey, {
    to: quoteToken,
    data: encodeFunctionData({
      abi: loadArtifact("TestToken").abi,
      functionName: "transfer",
      args: [quoteBook, parseEther("1000")],
    }),
    gas: 100_000n,
  });

  await sendAndWait(deployerKey, { to: quoteBook, value: parseEther("0.02"), gas: 100_000n });
  await sendAndWait(makerKey, {
    to: quoteBook,
    value: config.stake,
    data: encodeFunctionData({
      abi: loadArtifact("QuoteBook").abi,
      functionName: "stake",
      args: [config.unstakeDelay],
    }),
    gas: 300_000n,
  });

  const stake = await getStake(quoteBook);
  if (stake.amount < config.minStake) throw new Error("QuoteBook is not staked");

  const quoteBookCodeHash = await getCodeHash(quoteBook);
  writeState({ maker, quoteBook, quoteToken, quoteBookCodeHash });

  console.log(`QuoteBook ${quoteBook}`);
  console.log(`TestToken ${quoteToken}`);
  console.log(`maker ${maker}, staked ${stake.amount} wei`);
  console.log(`code hash ${quoteBookCodeHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
