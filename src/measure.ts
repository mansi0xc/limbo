import { config } from "./config.js";
import { buildDlc } from "./sign.js";
import { toWire } from "./frameTx/wire.js";
import { frameGas, validationGas, type FrameReceipt } from "./frameTx/send.js";
import { getTransactionReceipt, rpc } from "./rpc.js";
import { readState } from "./state.js";

interface Row {
  workload: string;
  preTrigger: string;
  trigger: string;
  promoted: string;
  validationGas: string;
  totalGas: string;
  triggerBlock: string;
  includedBlock: string;
  blocksAfterTrigger: string;
  loser: string;
}

const short = (text: string | undefined, max = 60): string => {
  if (!text) return "not recorded";
  const flat = text.replace(/\s+/g, " ");
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

async function receiptRow(
  workload: string,
  txHash: string | undefined,
  trigger: string,
  triggerBlock: string | undefined,
  preTrigger: string | undefined,
  loser: string
): Promise<Row | undefined> {
  if (!txHash) {
    console.log(`no promoted ${workload} transaction in the state; run its demo first`);
    return undefined;
  }
  const receipt = (await getTransactionReceipt(txHash as `0x${string}`)) as FrameReceipt | null;
  if (!receipt) {
    console.log(`receipt for ${txHash} not found`);
    return undefined;
  }

  const included = BigInt(receipt.blockNumber);
  const total = (receipt.frameReceipts ?? []).reduce((sum, frame) => sum + frameGas(frame.gasUsed), 0n);
  return {
    workload,
    preTrigger: short(preTrigger),
    trigger,
    promoted: txHash,
    validationGas: validationGas(receipt).toString(),
    totalGas: (total || frameGas(receipt.gasUsed)).toString(),
    triggerBlock: triggerBlock ?? "not recorded",
    includedBlock: included.toString(),
    blocksAfterTrigger: triggerBlock ? (included - BigInt(triggerBlock)).toString() : "n/a",
    loser,
  };
}

/**
 * Reads what the demos recorded and the promoted receipts, and prints a Markdown table. Every number
 * comes from a receipt or a recorded RPC verdict; nothing is estimated.
 */
async function main(): Promise<void> {
  const state = readState();

  console.log("ethrex_simulateFrameTransaction on the DLC NO cheque (root URL)");
  try {
    const checkout = await buildDlc();
    const simulated = await rpc(config.rootUrl, "ethrex_simulateFrameTransaction", [toWire(checkout.no.tx)]);
    console.log(JSON.stringify(simulated, null, 2));
  } catch (error) {
    console.log(`simulation unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  const rows = (
    await Promise.all([
      receiptRow(
        "deadman rescue",
        state.rescueTxHash,
        "anyone calls `expire`",
        state.rescueExpireBlock,
        state.rescuePreTriggerVerdict,
        "n/a (single cheque)"
      ),
      receiptRow(
        "binary DLC",
        state.dlcTxHash,
        "oracle attests NO",
        state.dlcAttestBlock,
        state.dlcPreTriggerVerdict,
        short(state.dlcLoserVerdict)
      ),
    ])
  ).filter((row): row is Row => Boolean(row));

  if (!rows.length) return;

  const header: [keyof Row, string][] = [
    ["workload", "Workload"],
    ["preTrigger", "Live mempool before trigger"],
    ["trigger", "Trigger"],
    ["triggerBlock", "Trigger block"],
    ["includedBlock", "Included block"],
    ["blocksAfterTrigger", "Blocks after trigger"],
    ["validationGas", "Validation gas"],
    ["totalGas", "Total frame gas"],
    ["loser", "Losing sibling resubmitted"],
    ["promoted", "Promoted tx"],
  ];

  console.log("");
  console.log(`| ${header.map(([, label]) => label).join(" | ")} |`);
  console.log(`|${header.map(() => "---").join("|")}|`);
  for (const row of rows) {
    console.log(`| ${header.map(([key]) => String(row[key]).replace(/\|/g, "\\|")).join(" | ")} |`);
  }
  console.log("");
  console.log(`explorer: ${config.explorerUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
