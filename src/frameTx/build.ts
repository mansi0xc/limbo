import { encodeAbiParameters, numberToHex, type Address, type Hex } from "viem";
import * as lib from "@forshtat/hegota-support/tx";
import { config } from "../config.js";
import { profile } from "./profile.js";
import type { FrameTransaction } from "./types.js";

export interface Trigger {
  latch: Address;
  eventId: Hex;
  expectedTag: number;
}

export interface Payout {
  to: Address;
  value: bigint;
}

export interface SenderCall {
  to: Address;
  value?: bigint;
  data?: Hex;
}

export interface LatchedTxInput {
  sender: Address;
  signers: Address[];
  trigger: Trigger;
  expiry: bigint;
  payouts: Payout[];
  calls?: SenderCall[];
  nonceKey: bigint;
  nonceSeq: bigint;
  maxFeePerGas?: bigint;
  chainId?: number;
}

const frame = (mode: string, init: Parameters<typeof lib.frame>[2]) => lib.frame(profile, mode, init);

/**
 * `[expiry_verify, self_verify(trigger), ...calls, ...payouts]`.
 *
 * The trigger is signed inside the self_verify frame data, so a parking node can check the declared
 * latch/event/tag without trusting the submitter.
 */
export function buildLatchedTx(input: LatchedTxInput): FrameTransaction {
  const triggerData = encodeAbiParameters(
    [{ type: "address" }, { type: "bytes32" }, { type: "uint8" }],
    [input.trigger.latch, input.trigger.eventId, input.trigger.expectedTag]
  );

  const frames = [
    frame("VERIFY", {
      target: config.expiryVerifier,
      execution: 30_000n,
      data: numberToHex(input.expiry, { size: 8 }),
    }),
    frame("VERIFY", {
      target: null,
      // The accounts read their own SENDER frames (FrameIntrospection), which costs a few helper calls per frame.
      execution: 200_000n,
      data: triggerData,
      scope: "EXECUTION_AND_PAYMENT",
    }),
    ...(input.calls ?? []).map((call) =>
      frame("SENDER", {
        target: call.to,
        execution: 50_000n,
        state: 100_000n,
        value: call.value ?? 0n,
        data: call.data,
      })
    ),
    ...input.payouts.map((payout) =>
      frame("SENDER", {
        target: payout.to,
        execution: 50_000n,
        state: 200_000n,
        value: payout.value,
      })
    ),
  ];

  return lib.newTx({
    chainId: BigInt(input.chainId ?? config.chainId),
    sender: input.sender,
    nonceSeq: input.nonceSeq,
    nonceKeys: [input.nonceKey],
    frames,
    signatures: input.signers.map((signer) => lib.secp256k1Placeholder(profile, signer)),
    fees: { maxFeePerGas: input.maxFeePerGas ?? config.maxFeePerGas },
  });
}

/** Signs the indexed signature entries; the signature hash covers the whole signed envelope. */
export async function signLatchedTx(tx: FrameTransaction, keys: Hex[]): Promise<FrameTransaction> {
  let out = tx;
  for (let i = 0; i < keys.length; i++) {
    out = await lib.signTx(profile, out, keys[i], i);
  }
  return out;
}

export const txHash = (tx: FrameTransaction): Hex => lib.txHash(profile, tx);
