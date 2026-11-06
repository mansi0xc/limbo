import type { Hex } from "viem";
import { sendFrameTx, validationGas, waitForReceipt } from "../frameTx/send.js";
import { writeState } from "../state.js";
import type { ParkStore } from "./store.js";
import type { ParkedEntry } from "./types.js";

export interface PromotionResult {
  hash: Hex;
  gasUsed: bigint;
  block: bigint;
}

/** Sends the parked bytes unchanged, waits for the receipt, and records the gas from the receipt. */
export async function promote(entry: ParkedEntry, store: ParkStore): Promise<PromotionResult> {
  const hash = await sendFrameTx(entry.tx);
  const receipt = await waitForReceipt(hash);
  const gasUsed = validationGas(receipt);
  const block = BigInt(receipt.blockNumber);

  store.setStatus(entry.id, "promoted", { txHash: hash, gasUsed, includedBlock: block });

  if (entry.kind === "rescue") {
    writeState({
      rescueTxHash: hash,
      rescueIncludedBlock: block.toString(),
      rescueGas: gasUsed.toString(),
    });
  } else {
    writeState({
      dlcTxHash: hash,
      dlcIncludedBlock: block.toString(),
      dlcGas: gasUsed.toString(),
    });
  }

  return { hash, gasUsed, block };
}
