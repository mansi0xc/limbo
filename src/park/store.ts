import type { Address, Hex } from "viem";
import type { EntryStatus, ParkedEntry, Trigger } from "./types.js";

export const triggerKey = (trigger: Trigger): string =>
  `${trigger.latch.toLowerCase()}:${trigger.eventId.toLowerCase()}:${trigger.expectedTag}`;

export const siblingKey = (sender: Address, key: bigint, seq: bigint): string =>
  `${sender.toLowerCase()}:${key}:${seq}`;

export class ParkStore {
  private readonly entries = new Map<string, ParkedEntry>();
  private readonly byTrigger = new Map<string, Set<string>>();
  private readonly byEntity = new Map<string, Set<string>>();
  private readonly bySibling = new Map<string, Set<string>>();

  add(entry: ParkedEntry): void {
    this.entries.set(entry.id, entry);

    const tKey = triggerKey(entry.trigger);
    if (!this.byTrigger.has(tKey)) this.byTrigger.set(tKey, new Set());
    this.byTrigger.get(tKey)!.add(entry.id);

    const eKey = entry.sender.toLowerCase();
    if (!this.byEntity.has(eKey)) this.byEntity.set(eKey, new Set());
    this.byEntity.get(eKey)!.add(entry.id);

    const sKey = siblingKey(entry.sender, entry.nonceKey, entry.nonceSeq);
    if (!this.bySibling.has(sKey)) this.bySibling.set(sKey, new Set());
    this.bySibling.get(sKey)!.add(entry.id);
  }

  get(id: string): ParkedEntry | undefined {
    return this.entries.get(id);
  }

  list(status?: EntryStatus): ParkedEntry[] {
    const all = [...this.entries.values()];
    return status ? all.filter((entry) => entry.status === status) : all;
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
  }
}
