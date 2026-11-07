import { createInterface } from "node:readline/promises";
import { encodeFunctionData } from "viem";
import { config } from "../config.js";
import { loadArtifact } from "../contracts.js";
import { sendFrameTx, explorerLink, validationGas, waitForReceipt } from "../frameTx/send.js";
import { sleep } from "../rpc.js";
import { buildRescue, park, waitForPromotion } from "../sign.js";
import { getBalance, sendAndWait } from "../chain.js";
import { readState, requireState, writeState } from "../state.js";

/** `--pause`: wait for Enter before expiring the latch, e.g. to stop node A on camera first. */
const PAUSE = process.argv.includes("--pause");

async function waitForEnter(prompt: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await rl.question(prompt);
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  // Drop the previous run's promotion so waitForPromotion can't return a stale hash after a redeploy.
  writeState({ rescueTxHash: undefined, rescueIncludedBlock: undefined, rescueGas: undefined });
  const state = readState();
  const checkout = await buildRescue();
  const beneficiary = requireState("beneficiary");
  const before = await getBalance(beneficiary);

  console.log("1. submit the pre-signed rescue to the live alt-mempool before the latch changes");
  try {
    const hash = await sendFrameTx(checkout.tx);
    console.log(`   unexpected: the live mempool accepted ${hash}`);
    writeState({ rescuePreTriggerVerdict: `accepted ${hash}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`   rejected as expected: ${message}`);
    writeState({ rescuePreTriggerVerdict: `rejected: ${message}` });
  }

  console.log("2. park the same bytes");
  const parked = await park(checkout);
  console.log(`   node A: ${parked.ok ? "accepted" : "rejected"} ${parked.rule} ${parked.reason}`);
  if (!parked.ok) throw new Error("park node A rejected the rescue");
  if (parked.peer) {
    console.log(`   node B: ${parked.peer.ok ? "accepted" : "rejected"} ${parked.peer.rule} ${parked.peer.reason}`);
  }

  const deadline = BigInt(requireState("rescueDeadline"));
  const grace = config.rescue.grace;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const waitSeconds = Number(deadline + grace + 2n - now);
  if (waitSeconds > 0) {
    console.log(`3. owner is offline; waiting ${waitSeconds}s for the grace window`);
    await sleep(waitSeconds * 1000);
  }

  if (PAUSE) {
    await waitForEnter("   paused: the latch can be expired now. Press Enter to expire it... ");
  }

  console.log("4. anyone expires the latch");
  const { hash: expireHash, receipt: expireReceipt } = await sendAndWait(requireState("deployerKey"), {
    to: requireState("rescueLatch"),
    data: encodeFunctionData({
      abi: loadArtifact("Latch").abi,
      functionName: "expire",
      args: [requireState("rescueEventId")],
    }),
    gas: 300_000n,
  });

  writeState({ rescueExpireTx: expireHash, rescueExpireBlock: BigInt(expireReceipt.blockNumber).toString() });

  console.log("5. the park node promotes the rescue");
  const promoted = await waitForPromotion("rescue");
  const receipt = await waitForReceipt(promoted);
  const after = await getBalance(beneficiary);

  console.log("");
  console.log("deadman rescue");
  console.log(`  expire          ${expireHash}`);
  console.log(`  promoted        ${promoted}`);
  console.log(`  block           ${BigInt(receipt.blockNumber).toString()}`);
  console.log(`  validation gas  ${validationGas(receipt)}`);
  console.log(`  beneficiary     ${before} -> ${after} wei`);
  console.log(`  explorer        ${explorerLink(promoted)}`);
  console.log(`  parked entry    ${state.rescueAccount}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
