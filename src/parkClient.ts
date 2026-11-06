import type { Hex } from "viem";
import { config } from "./config.js";
import { toWire } from "./frameTx/wire.js";
import { sleep } from "./rpc.js";
import { readState } from "./state.js";
import type { Cheque } from "./cheques.js";

export async function park(cheque: Cheque, port: number = config.ports.a): Promise<any> {
  const response = await fetch(`http://127.0.0.1:${port}/park`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tx: toWire(cheque.tx), trigger: cheque.trigger }),
  });

  return await response.json();
}

export async function nodeStatus(port: number = config.ports.a): Promise<any> {
  const response = await fetch(`http://127.0.0.1:${port}/status`);
  return await response.json();
}

export async function waitForPromotion(kind: "rescue" | "dlc", timeoutMs = 180_000): Promise<Hex> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = readState();
    const hash = kind === "rescue" ? state.rescueTxHash : state.dlcTxHash;
    if (hash) return hash;
    await sleep(1000);
  }
  throw new Error(`no ${kind} promotion within ${timeoutMs}ms; check the park node and the latch state`);
}
