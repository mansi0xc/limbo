import type { Hex } from "viem";
import { config } from "../config.js";
import { getTransactionCount, rpc, waitMined } from "../rpc.js";
import { encodeRawFrameTx } from "./codec.js";
import { toWire } from "./wire.js";
import type { FrameTransaction } from "./types.js";

export async function sendFrameTx(tx: FrameTransaction): Promise<Hex> {
  return (await rpc(config.gatewayUrl, "eth_sendFrameTransaction", [toWire(tx)])) as Hex;
}

/** The canonical mempool's verdict: the gateway forwards the raw type-0x06 transaction to ethrex. */
export async function sendRawFrameTx(tx: FrameTransaction): Promise<Hex> {
  return (await rpc(config.gatewayUrl, "eth_sendRawTransaction", [encodeRawFrameTx(tx)])) as Hex;
}

/** A frame receipt's gas can be a single quantity or an [execution, state] pair. */
export type GasUsed = Hex | [Hex, Hex];

export interface FrameReceipt {
  status: Hex;
  blockNumber: Hex;
  gasUsed?: GasUsed;
  frameReceipts?: { status: Hex; gasUsed?: GasUsed }[];
  [key: string]: unknown;
}

export function frameGas(gasUsed: GasUsed | undefined): bigint {
  if (!gasUsed) return 0n;
  if (Array.isArray(gasUsed)) return BigInt(gasUsed[0]) + BigInt(gasUsed[1]);
  return BigInt(gasUsed);
}

/** Validation gas is the expiry frame (0) plus the account's self_verify frame (1). */
export function validationGas(receipt: FrameReceipt): bigint {
  const frames = receipt.frameReceipts ?? [];
  if (!frames.length) return frameGas(receipt.gasUsed);
  return frames.slice(0, 2).reduce((sum, frame) => sum + frameGas(frame.gasUsed), 0n);
}

export async function waitForReceipt(hash: Hex): Promise<FrameReceipt> {
  const receipt = (await waitMined(hash)) as FrameReceipt;
  const failed = (receipt.frameReceipts ?? [])
    .map((frame, i) => ({ i, ok: frame.status === "0x1" }))
    .filter((frame) => !frame.ok);

  if (receipt.status !== "0x1" || failed.length) {
    throw new Error(
      `transaction ${hash} was mined but frame(s) ${failed.map((frame) => frame.i).join(", ") || "?"} failed`
    );
  }
  return receipt;
}

export async function accountNonce(address: `0x${string}`): Promise<bigint> {
  return BigInt(await getTransactionCount(address, "latest"));
}

export const explorerLink = (hash: Hex): string => `${config.explorerUrl} (search ${hash})`;
