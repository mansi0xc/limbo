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

export interface FrameReceipt {
  status: Hex;
  blockNumber: Hex;
  gasUsed?: Hex;
  frameReceipts?: { status: Hex; gasUsed?: Hex }[];
  [key: string]: unknown;
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
