import { formatEther, keccak256, toBytes, zeroAddress, type Address, type Hex } from "viem";
import { config } from "./config.js";
import {
  deployContract,
  getCodeHash,
  getStake,
  readBothFunded,
  readLatchDeadline,
  sendLegacy,
  loadArtifact,
} from "./contracts.js";
import { getBalance, waitMined } from "./rpc.js";
import { addressOf, ensureKey, writeState } from "./state.js";
import { encodeFunctionData } from "viem";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendAndWait(key: Hex, tx: Parameters<typeof sendLegacy>[1]): Promise<Hex> {
  const hash = await sendLegacy(key, tx);
  const receipt = await waitMined(hash);
  if (receipt.status !== "0x1") throw new Error(`transaction ${hash} reverted`);
  return hash;
}

async function fund(from: Hex, to: Address, value: bigint): Promise<void> {
  const hash = await sendAndWait(from, { to, value, gas: 100_000n });
  console.log(`funded ${to} with ${formatEther(value)} ETH (${hash})`);
}

async function main(): Promise<void> {
  const deployerKey = ensureKey("deployer");
  const ownerKey = ensureKey("owner");
  const aliceKey = ensureKey("alice");
  const bobKey = ensureKey("bob");
  const oracleKey = ensureKey("oracle");
  const beneficiaryKey = ensureKey("beneficiary");

  const deployer = addressOf(deployerKey);
  const owner = addressOf(ownerKey);
  const alice = addressOf(aliceKey);
  const bob = addressOf(bobKey);
  const oracle = addressOf(oracleKey);
  const beneficiary = addressOf(beneficiaryKey);

  const balance = await getBalance(deployer);
  console.log(`deployer ${deployer}: ${formatEther(balance)} ETH`);
  if (balance < 400_000_000_000_000_000n) {
    throw new Error(
      `deployer ${deployer} has ${formatEther(balance)} ETH; fund it or set TRELLIS_DEPLOYER_KEY to a funded devnet key`
    );
  }

  await fund(deployerKey, owner, 50_000_000_000_000_000n);
  await fund(deployerKey, alice, 120_000_000_000_000_000n);
  await fund(deployerKey, bob, 120_000_000_000_000_000n);

  const rescueEventId = keccak256(toBytes("trellis:rescue"));
  const dlcEventId = keccak256(toBytes("trellis:dlc"));

  console.log("deploying the rescue latch and account...");
  const rescueLatch = await deployContract(
    "Latch",
    [owner, zeroAddress, config.rescue.interval, config.rescue.grace],
    0n,
    deployerKey
  );
  const rescueAccount = await deployContract(
    "RescueAccount",
    [owner, beneficiary, rescueLatch, rescueEventId, config.rescue.amount, config.rescue.gasBuffer, config.stakingRegistry],
    config.rescue.amount + config.rescue.gasBuffer,
    deployerKey
  );

  console.log("deploying the DLC latch and account...");
  const dlcLatch = await deployContract(
    "Latch",
    [deployer, oracle, 0n, config.dlc.grace],
    0n,
    deployerKey
  );
  const dlcAccount = await deployContract(
    "DLCAccount",
    [
      alice,
      bob,
      dlcLatch,
      dlcEventId,
      config.dlc.payoutA,
      config.dlc.payoutB,
      config.dlc.gasBuffer,
      config.stakingRegistry,
    ],
    config.dlc.gasBuffer,
    deployerKey
  );

  console.log("opening the latches...");
  const rescuePingTx = await sendAndWait(ownerKey, {
    to: rescueLatch,
    data: encodeFunctionData({
      abi: loadArtifact("Latch").abi,
      functionName: "ping",
      args: [rescueEventId],
    }),
    gas: 150_000n,
  });

  const now = BigInt(Math.floor(Date.now() / 1000));
  const dlcOpenTx = await sendAndWait(deployerKey, {
    to: dlcLatch,
    data: encodeFunctionData({
      abi: loadArtifact("Latch").abi,
      functionName: "open",
      args: [dlcEventId, now + config.dlc.deadlineSeconds],
    }),
    gas: 150_000n,
  });

  console.log("staking the accounts...");
  const rescueStakeTx = await sendAndWait(ownerKey, {
    to: rescueAccount,
    value: config.stake,
    data: encodeFunctionData({
      abi: loadArtifact("RescueAccount").abi,
      functionName: "stake",
      args: [config.unstakeDelay],
    }),
    gas: 300_000n,
  });

  const dlcStakeTx = await sendAndWait(aliceKey, {
    to: dlcAccount,
    value: config.stake,
    data: encodeFunctionData({
      abi: loadArtifact("DLCAccount").abi,
      functionName: "stake",
      args: [config.unstakeDelay],
    }),
    gas: 300_000n,
  });

  console.log("funding the DLC...");
  await sendAndWait(aliceKey, {
    to: dlcAccount,
    value: config.dlc.deposit,
    data: encodeFunctionData({ abi: loadArtifact("DLCAccount").abi, functionName: "deposit" }),
    gas: 200_000n,
  });
  await sendAndWait(bobKey, {
    to: dlcAccount,
    value: config.dlc.deposit,
    data: encodeFunctionData({ abi: loadArtifact("DLCAccount").abi, functionName: "deposit" }),
    gas: 200_000n,
  });

  await sleep(1000);

  const rescueDeadline = await readLatchDeadline(rescueLatch, rescueEventId);
  const dlcDeadline = await readLatchDeadline(dlcLatch, dlcEventId);
  const rescueExpiry = rescueDeadline + config.chequeExpirySeconds;
  const dlcExpiry = dlcDeadline + config.chequeExpirySeconds;

  const rescueStake = await getStake(rescueAccount);
  const dlcStake = await getStake(dlcAccount);
  if (rescueStake.amount < config.minStake) throw new Error("rescue account is not staked");
  if (dlcStake.amount < config.minStake) throw new Error("DLC account is not staked");
  if (!(await readBothFunded(dlcAccount))) throw new Error("DLC is not funded on both sides");

  const rescueCodeHash = await getCodeHash(rescueAccount);
  const dlcCodeHash = await getCodeHash(dlcAccount);

  writeState({
    deployer,
    owner,
    alice,
    bob,
    oracle,
    beneficiary,
    rescueLatch,
    rescueAccount,
    rescueEventId,
    rescueDeadline: rescueDeadline.toString(),
    rescueExpiry: rescueExpiry.toString(),
    rescueCodeHash,
    rescueStakeTx,
    rescuePingTx,
    dlcLatch,
    dlcAccount,
    dlcEventId,
    dlcDeadline: dlcDeadline.toString(),
    dlcExpiry: dlcExpiry.toString(),
    dlcCodeHash,
    dlcStakeTx,
    dlcOpenTx,
  });

  console.log("");
  console.log("trellis is ready");
  console.log(`  rescue latch   ${rescueLatch}`);
  console.log(`  rescue account ${rescueAccount} (staked ${formatEther(rescueStake.amount)} ETH)`);
  console.log(`  rescue expiry  ${rescueExpiry}`);
  console.log(`  DLC latch      ${dlcLatch}`);
  console.log(`  DLC account    ${dlcAccount} (staked ${formatEther(dlcStake.amount)} ETH, funded)`);
  console.log(`  DLC expiry     ${dlcExpiry}`);
  console.log("next: yarn park:a and yarn park:b in two terminals, then yarn demo:deadman");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
