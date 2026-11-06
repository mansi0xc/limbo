import { RpcError, rpc as libRpc } from "@forshtat/hegota-support/rpc";
import type { Address, Hex } from "viem";
import { config } from "./config.js";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** JSON-RPC through the gateway, keeping the library's error codes. */
export async function rpc(url: string, method: string, params: unknown[] = []): Promise<any> {
  try {
    return await libRpc(url, method, params);
  } catch (error) {
    if (error instanceof RpcError) throw error;
    throw error;
  }
}

export async function getCode(address: Address): Promise<Hex> {
  return (await rpc(config.gatewayUrl, "eth_getCode", [address, "latest"])) as Hex;
}

export async function getBalance(address: Address): Promise<bigint> {
  return BigInt(await rpc(config.gatewayUrl, "eth_getBalance", [address, "latest"]));
}

export async function getTransactionCount(address: Address, tag: "pending" | "latest" = "pending"): Promise<number> {
  return Number(BigInt(await rpc(config.gatewayUrl, "eth_getTransactionCount", [address, tag])));
}

export async function getTransactionReceipt(hash: Hex): Promise<any> {
  return await rpc(config.gatewayUrl, "eth_getTransactionReceipt", [hash]);
}

export async function getBlockNumber(): Promise<bigint> {
  return BigInt(await rpc(config.gatewayUrl, "eth_blockNumber", []));
}

export async function ethCall(to: Address, data: Hex): Promise<Hex> {
  return (await rpc(config.gatewayUrl, "eth_call", [{ to, data }, "latest"])) as Hex;
}

export async function waitMined(hash: Hex, timeoutSec = config.txTimeoutSec): Promise<any> {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const receipt = await getTransactionReceipt(hash);
    if (receipt) return receipt;
    await sleep(1500);
  }
  throw new Error(`transaction ${hash} was not mined within ${timeoutSec}s`);
}
