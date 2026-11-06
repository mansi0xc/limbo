import fs from "node:fs";
import path from "node:path";
import type { Address, Hex } from "viem";
import type { EntryStatus, ParkedEntry, Trigger } from "./types.js";

export const triggerKey = (trigger: Trigger): string =>
  `${trigger.latch.toLowerCase()}:${trigger.eventId.toLowerCase()}:${trigger.expectedTag}`;

export const siblingKey = (sender: Address, key: bigint, seq: bigint): string =>
  `${sender.toLowerCase()}:${key}:${seq}`;

/** Statuses that still hold a transaction: a resubmission of the same bytes is a duplicate. */
const LIVE: ReadonlySet<EntryStatus> = new Set(["parked", "promoted"]);

/** JSON with bigints, which the frame transaction and the entries are full of. */
const replacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? { $bigint: value.toString() } : value;
const reviver = (_key: string, value: any) =>
  value && typeof value === "object" && typeof value.$bigint === "string" && Object.keys(value).length === 1
    ? BigInt(value.$bigint)
    : value;

export interface ParkStoreOptions {
  /** Persist every change to this file and load it on start. In memory only when omitted. */
  file?: string;
}

export class ParkStore {
  private readonly entries = new Map<string, ParkedEntry>();
  private readonly byTrigger = new Map<string, Set<string>>();
  private readonly byEntity = new Map<string, Set<string>>();
  private readonly bySibling = new Map<string, Set<string>>();
  private readonly byTxId = new Map<string, Set<string>>();
  private readonly file?: string;

  constructor(options: ParkStoreOptions = {}) {
    this.file = options.file;
    if (this.file && fs.existsSync(this.file)) {
      const saved = JSON.parse(fs.readFileSync(this.file, "utf8"), reviver) as ParkedEntry[];
      for (const entry of saved) this.index(entry);
    }
  }

  add(entry: ParkedEntry): void {
    this.index(entry);
    this.persist();
  }

  get(id: string): ParkedEntry | undefined {
    return this.entries.get(id);
  }

  list(status?: EntryStatus): ParkedEntry[] {
    const all = [...this.entries.values()];
    return status ? all.filter((entry) => entry.status === status) : all;
  }

  /** A parked or promoted entry with the same wire bytes, if any. */
  findLive(txId: Hex): ParkedEntry | undefined {
    const ids = this.byTxId.get(txId.toLowerCase()) ?? new Set();
    return [...ids].map((id) => this.entries.get(id)).find((entry) => entry && LIVE.has(entry.status));
  }

  countByTrigger(trigger: Trigger): number {
    const ids = this.byTrigger.get(triggerKey(trigger)) ?? new Set();
    return [...ids].filter((id) => this.entries.get(id)?.status === "parked").length;
  }

  countByEntity(sender: Address): number {
    const ids = this.byEntity.get(sender.toLowerCase()) ?? new Set();
    return [...ids].filter((id) => this.entries.get(id)?.status === "parked").length;
  }

  siblings(sender: Address, key: bigint, seq: bigint): ParkedEntry[] {
    const ids = this.bySibling.get(siblingKey(sender, key, seq)) ?? new Set();
    return [...ids].map((id) => this.entries.get(id)).filter((entry): entry is ParkedEntry => Boolean(entry));
  }

  setStatus(id: string, status: EntryStatus, patch: Partial<ParkedEntry> = {}): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    Object.assign(entry, patch, { status });
    this.persist();
  }

  private index(entry: ParkedEntry): void {
    this.entries.set(entry.id, entry);
    const put = (map: Map<string, Set<string>>, key: string) => {
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(entry.id);
    };
    put(this.byTrigger, triggerKey(entry.trigger));
    put(this.byEntity, entry.sender.toLowerCase());
    put(this.bySibling, siblingKey(entry.sender, entry.nonceKey, entry.nonceSeq));
    if (entry.txId) put(this.byTxId, entry.txId.toLowerCase());
  }

  /** Write to a temp file and rename, so a crash never leaves a half-written store. */
  private persist(): void {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify([...this.entries.values()], replacer));
    fs.renameSync(tmp, this.file);
  }
}
