import type { Hex } from "viem";
import { txHash } from "../frameTx/build.js";
import { sendFrameTx, validationGas, waitForReceipt, type FrameReceipt } from "../frameTx/send.js";
import { getTransactionReceipt } from "../rpc.js";
import { writeState } from "../state.js";
import type { ParkStore } from "./store.js";
import type { ParkedEntry } from "./types.js";

export interface PromotionResult {
  hash: Hex;
  gasUsed: bigint;
  block: bigint;
}

/**
 * A promotion failure. `terminal` failures will never succeed on retry: the transaction was mined with a
 * failed frame, or its nonce key was already consumed (by a sibling, or by someone who sent the winner).
 */
export class PromotionError extends Error {
  constructor(
    message: string,
    readonly terminal: boolean
  ) {
    super(message);
  }
}

const NONCE_CONSUMED = /nonce/i;

/**
 * Sends the parked bytes unchanged, waits for the receipt, and records the gas from the receipt.
 *
 * Idempotent: if the same bytes have already landed (the peer node or the winner itself sent them),
 * it records that receipt instead of sending again.
 */
export async function promote(entry: ParkedEntry, store: ParkStore): Promise<PromotionResult> {
  const expected = txHash(entry.tx);
  let receipt = (await getTransactionReceipt(expected).catch(() => null)) as FrameReceipt | null;
  let hash = expected;

  if (!receipt) {
    try {
      hash = await sendFrameTx(entry.tx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new PromotionError(message, NONCE_CONSUMED.test(message));
    }
  }

  try {
    receipt = await waitForReceipt(hash);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // "was mined but frame(s) ... failed" is final; a receipt timeout is not.
    throw new PromotionError(message, /was mined/.test(message));
  }

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
