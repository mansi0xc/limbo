import {
  createPublicClient,
  http,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";
import { getTransactionCount, rpc, sleep, waitMined } from "./rpc.js";

export const publicClient = createPublicClient({
  chain: {
    id: config.chainId,
    name: "alt-mempool-devnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.gatewayUrl] } },
  },
  transport: http(config.gatewayUrl),
});

export interface LegacyTx {
  to: Address | null;
  value?: bigint;
  data?: Hex;
  gas?: bigint;
}

/** Sends a legacy transaction through the gateway. Re-reads the pending nonce on every attempt. */
export async function sendLegacy(key: Hex, tx: LegacyTx, retries = 10): Promise<Hex> {
  const account = privateKeyToAccount(key);
  let last: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const nonce = await getTransactionCount(account.address, "pending");
      const raw = await account.signTransaction({
        chainId: config.chainId,
        nonce,
        to: tx.to,
        value: tx.value ?? 0n,
        data: tx.data ?? "0x",
        gas: tx.gas ?? config.legacyGasLimit,
        gasPrice: config.legacyGasPrice,
        type: "legacy",
      });
      return (await rpc(config.gatewayUrl, "eth_sendRawTransaction", [raw])) as Hex;
    } catch (error) {
      last = error;
      if (attempt < retries) await sleep(250 + attempt * 200);
    }
  }

  throw last;
}

export async function sendAndWait(key: Hex, tx: LegacyTx): Promise<any> {
  const hash = await sendLegacy(key, tx);
  const receipt = await waitMined(hash);
  if (receipt.status !== "0x1") throw new Error(`transaction ${hash} reverted`);
  return { hash, receipt };
}

export async function getCodeHash(address: Address): Promise<Hex> {
  const code = await retryRead(() => publicClient.getCode({ address }));
  return keccak256(code ?? "0x");
}

async function retryRead<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (attempt < attempts - 1) await sleep(500 * (attempt + 1));
    }
  }
  throw last;
}

export interface StakeInfo {
  amount: bigint;
  unstakeDelay: number;
  withdrawTime: number;
}

const DEPOSIT_INFO_ABI = [
  {
    type: "function",
    name: "getDepositInfo",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }, { type: "uint32" }, { type: "uint64" }],
  },
] as const;

export async function getStake(address: Address): Promise<StakeInfo> {
  const out = (await retryRead(() =>
    publicClient.readContract({
      address: config.stakingRegistry,
      abi: DEPOSIT_INFO_ABI,
      functionName: "getDepositInfo",
      args: [address],
    })
  )) as readonly [bigint, number, bigint];

  return {
    amount: out[0],
    unstakeDelay: Number(out[1]),
    withdrawTime: Number(out[2]),
  };
}

const LATCH_ABI = [
  {
    type: "function",
    name: "state",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "deadline",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "grace",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
] as const;

export async function readLatchState(latch: Address, eventId: Hex): Promise<number> {
  return Number(
    await retryRead(() =>
      publicClient.readContract({
        address: latch,
        abi: LATCH_ABI,
        functionName: "state",
        args: [eventId],
      })
    )
  );
}

export async function readLatchDeadline(latch: Address, eventId: Hex): Promise<bigint> {
  return BigInt(
    await retryRead(() =>
      publicClient.readContract({
        address: latch,
        abi: LATCH_ABI,
        functionName: "deadline",
        args: [eventId],
      })
    )
  );
}

export async function readLatchGrace(latch: Address): Promise<number> {
  return Number(
    await retryRead(() =>
      publicClient.readContract({
        address: latch,
        abi: LATCH_ABI,
        functionName: "grace",
      })
    )
  );
}

const DLC_READ_ABI = [
  {
    type: "function",
    name: "bothFunded",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "deposits",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export async function readBothFunded(account: Address): Promise<boolean> {
  return await retryRead(() =>
    publicClient.readContract({
      address: account,
      abi: DLC_READ_ABI,
      functionName: "bothFunded",
    })
  );
}

export async function readDeposit(account: Address, party: Address): Promise<bigint> {
  return await retryRead(() =>
    publicClient.readContract({
      address: account,
      abi: DLC_READ_ABI,
      functionName: "deposits",
      args: [party],
    })
  );
}

export { waitMined };
export { getBalance } from "./rpc.js";
