import { encodeFunctionData, type Address, type Hex } from "viem";
import * as lib from "@forshtat/hegota-support/tx";
import { config } from "../config.js";
import { loadArtifact } from "../contracts.js";
import { profile } from "./profile.js";
import type { FrameTransaction } from "./types.js";

const frame = (mode: string, init: Parameters<typeof lib.frame>[2]) => lib.frame(profile, mode, init);
const secp = (signer: Address) => lib.secp256k1Placeholder(profile, signer);

export interface QuoteTxInput {
  maker: Address;
  quoteBook: Address;
  seq: bigint;
  price: bigint;
  maxSize: bigint;
  nonceKey?: bigint;
  nonceSeq?: bigint;
  chainId?: number;
  maxFeePerGas?: bigint;
}

/** `[self_verify(maker), SENDER(QuoteBook.postQuote)]`. No expiry frame: PRED is one block. */
export function buildQuoteTx(input: QuoteTxInput): FrameTransaction {
  const abi = loadArtifact("QuoteBook").abi;
  const frames = [
    frame("VERIFY", { target: null, execution: 70_000n, scope: "EXECUTION_AND_PAYMENT" }),
    frame("SENDER", {
      target: input.quoteBook,
      execution: 200_000n,
      state: 300_000n,
      data: encodeFunctionData({
        abi,
        functionName: "postQuote",
        args: [input.seq, input.price, input.maxSize],
      }),
    }),
  ];

  return lib.newTx({
    chainId: BigInt(input.chainId ?? config.chainId),
    sender: input.maker,
    nonceSeq: input.nonceSeq ?? 0n,
    nonceKeys: [input.nonceKey ?? input.seq],
    frames,
    signatures: [secp(input.maker)],
    fees: { maxFeePerGas: input.maxFeePerGas ?? config.maxFeePerGas },
  });
}

export interface TakeTxInput {
  trader: Address;
  quoteBook: Address;
  seq: bigint;
  amountIn: bigint;
  minOut: bigint;
  assertFilled?: boolean;
  nonceKey?: bigint;
  nonceSeq?: bigint;
  chainId?: number;
  maxFeePerGas?: bigint;
}

/** `[only_verify(trader), pay(validateTake), SENDER(take)]` plus an optional assert frame. */
export function buildTakeTx(input: TakeTxInput): FrameTransaction {
  const abi = loadArtifact("QuoteBook").abi;
  const frames = [
    frame("VERIFY", { target: null, execution: 50_000n, scope: "EXECUTION" }),
    frame("VERIFY", {
      target: input.quoteBook,
      execution: 150_000n,
      scope: "PAYMENT",
      data: encodeFunctionData({
        abi,
        functionName: "validateTake",
        args: [input.seq, input.amountIn, input.minOut],
      }),
    }),
    frame("SENDER", {
      target: input.quoteBook,
      execution: 250_000n,
      state: 300_000n,
      value: input.amountIn,
      data: encodeFunctionData({
        abi,
        functionName: "take",
        args: [input.seq, input.minOut],
      }),
    }),
  ];

  if (input.assertFilled) {
    frames.push(
      frame("VERIFY", {
        target: input.quoteBook,
        execution: 50_000n,
        data: encodeFunctionData({ abi, functionName: "assertFilled" }),
      })
    );
  }

  return lib.newTx({
    chainId: BigInt(input.chainId ?? config.chainId),
    sender: input.trader,
    nonceSeq: input.nonceSeq ?? 0n,
    nonceKeys: [input.nonceKey ?? 2n],
    frames,
    signatures: [secp(input.trader)],
    fees: { maxFeePerGas: input.maxFeePerGas ?? config.maxFeePerGas },
  });
}

export async function signPredTx(tx: FrameTransaction, key: Hex): Promise<FrameTransaction> {
  return await lib.signTx(profile, tx, key, 0);
}

export const predTxHash = (tx: FrameTransaction): Hex => lib.txHash(profile, tx);
