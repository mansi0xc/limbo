import type { Address, Hex } from "viem";
import type { FrameTransaction } from "../frameTx/types.js";

export interface Trigger {
  latch: Address;
  eventId: Hex;
  expectedTag: number;
}

export interface Template {
  kind: "rescue" | "dlc";
  account: Address;
  codeHash: Hex;
  latch: Address;
  eventId: Hex;
  allowedTags: number[];
  signers: Address[];
}

export interface StakeInfo {
  amount: bigint;
  unstakeDelay: number;
  withdrawTime: number;
}

export interface ChainReader {
  readCodeHash(address: Address): Promise<Hex>;
  readStake(address: Address): Promise<StakeInfo>;
  readLatchState(latch: Address, eventId: Hex): Promise<number>;
  readLatchDeadline(latch: Address, eventId: Hex): Promise<bigint>;
  readLatchGrace(latch: Address): Promise<number>;
  now(): Promise<bigint>;
}

/**
 * - parked: waiting for its trigger;
 * - promoted: landed on chain (sent by this node or seen landed);
 * - evicted: lost to the latch state or to a promoted sibling;
 * - expired: its expiry_verify deadline passed;
 * - failed: a promotion failed for good (mined with a failed frame, or its nonce was already consumed).
 */
export type EntryStatus = "parked" | "promoted" | "evicted" | "expired" | "failed" | "rejected";

export interface ParkedEntry {
  id: string;
  /** keccak256 of the wire bytes; identical resubmissions share it. */
  txId: Hex;
  kind: "rescue" | "dlc";
  tx: FrameTransaction;
  trigger: Trigger;
  sender: Address;
  nonceKey: bigint;
  nonceSeq: bigint;
  expiry: bigint;
  codeHash: Hex;
  signers: Address[];
  status: EntryStatus;
  receivedAt: number;
  txHash?: Hex;
  gasUsed?: bigint;
  includedBlock?: bigint;
  error?: string;
  /** Failed promotion attempts so far. */
  attempts?: number;
  /** Wall-clock ms before which the indexer does not retry this entry. */
  nextAttemptAt?: number;
}

export interface Validation {
  ok: boolean;
  rule: string;
  reason: string;
  entry?: ParkedEntry;
}
