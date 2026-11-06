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
  now(): Promise<bigint>;
}

export type EntryStatus = "parked" | "promoted" | "evicted" | "expired" | "rejected";

export interface ParkedEntry {
  id: string;
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
}

export interface Validation {
  ok: boolean;
  rule: string;
  reason: string;
  entry?: ParkedEntry;
}
