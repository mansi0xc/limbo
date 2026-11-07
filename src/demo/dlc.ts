import { encodeFunctionData } from "viem";
import { config } from "../config.js";
import { loadArtifact } from "../contracts.js";
import { sendFrameTx, explorerLink, validationGas, waitForReceipt } from "../frameTx/send.js";
import { getBalance, sendAndWait } from "../chain.js";
import { buildDlc, nodeStatus, park, waitForPromotion } from "../sign.js";
import { readState, requireState, writeState } from "../state.js";

async function main(): Promise<void> {
  // Drop the previous run's promotion so waitForPromotion can't return a stale hash after a redeploy.
  writeState({ dlcTxHash: undefined, dlcIncludedBlock: undefined, dlcGas: undefined });
  const checkout = await buildDlc();
  const bob = requireState("bob");
  const before = await getBalance(bob);

  console.log("1. submit a DLC cheque directly; the latch is unset");
  try {
    const hash = await sendFrameTx(checkout.yes.tx);
    console.log(`   unexpected: the live mempool accepted ${hash}`);
    writeState({ dlcPreTriggerVerdict: `accepted ${hash}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`   rejected as expected: ${message}`);
    writeState({ dlcPreTriggerVerdict: `rejected: ${message}` });
  }

  console.log("2. park YES and NO, which share one nonce key");
  const yes = await park(checkout.yes);
  const no = await park(checkout.no);
  console.log(`   YES: ${yes.ok ? "accepted" : "rejected"} ${yes.rule} ${yes.reason}`);
  console.log(`   NO:  ${no.ok ? "accepted" : "rejected"} ${no.rule} ${no.reason}`);
  if (!yes.ok || !no.ok) throw new Error("park nodes rejected a DLC cheque");
  if (yes.peer) console.log(`   node B YES: ${yes.peer.ok ? "accepted" : "rejected"} ${yes.peer.rule}`);
  if (no.peer) console.log(`   node B NO:  ${no.peer.ok ? "accepted" : "rejected"} ${no.peer.rule}`);

  console.log("3. the oracle attests NO");
  const { hash: attestHash, receipt: attestReceipt } = await sendAndWait(requireState("oracleKey"), {
    to: requireState("dlcLatch"),
    data: encodeFunctionData({
      abi: loadArtifact("Latch").abi,
      functionName: "attest",
      args: [requireState("dlcEventId"), false],
    }),
    gas: 120_000n,
  });
  writeState({
    dlcAttestTx: attestHash,
    dlcAttestBlock: BigInt(attestReceipt.blockNumber).toString(),
  });

  console.log("4. the park node promotes NO and evicts YES without simulating it");
  const promoted = await waitForPromotion("dlc");
  const receipt = await waitForReceipt(promoted);
  const after = await getBalance(bob);

  console.log("5. resubmit YES; the shared key is already consumed");
  try {
    const hash = await sendFrameTx(checkout.yes.tx);
    console.log(`   unexpected: the losing cheque was accepted ${hash}`);
    writeState({ dlcLoserVerdict: `accepted ${hash}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`   rejected as expected: ${message}`);
    writeState({ dlcLoserVerdict: `rejected: ${message}` });
  }

  const status = await nodeStatus();
  console.log("");
  console.log("binary DLC");
  console.log(`  attest          ${attestHash}`);
  console.log(`  promoted NO     ${promoted}`);
  console.log(`  block           ${BigInt(receipt.blockNumber).toString()}`);
  console.log(`  validation gas  ${validationGas(receipt)}`);
  console.log(`  Bob             ${before} -> ${after} wei (expected +${config.dlc.payoutA + config.dlc.payoutB})`);
  console.log(`  explorer        ${explorerLink(promoted)}`);
  console.log(`  parked          ${status.entries.filter((entry: any) => entry.kind === "dlc").map((entry: any) => `${entry.trigger.expectedTag}:${entry.status}`).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
