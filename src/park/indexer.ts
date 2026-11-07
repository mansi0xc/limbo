import type { ParkStore } from "./store.js";
import { siblingKey } from "./store.js";
import { promote as defaultPromote, PromotionError, type PromotionResult } from "./promoter.js";
import type { ChainReader, ParkedEntry, Template } from "./types.js";

export type PromoteFn = (entry: ParkedEntry, store: ParkStore) => Promise<PromotionResult>;

export interface IndexerOptions {
  /** The primary node promotes as soon as the latch settles. */
  primary: boolean;
  /**
   * A non-primary node promotes a matching entry that is still parked this long after it first saw the
   * latch settle. The shared nonce key makes a double send harmless; the promoter is idempotent.
   */
  fallbackAfterMs: number;
  /** First retry delay after a transient promotion failure; doubles per attempt. */
  retryBaseMs?: number;
  /** Upper bound of the retry delay. */
  retryMaxMs?: number;
  promoteFn?: PromoteFn;
  /** Wall clock in ms, injectable for tests. */
  clock?: () => number;
}

/**
 * Watches each latch and applies PARK-060:
 *
 * - entries whose tag does not match the new state are evicted without simulation;
 * - matching entries are grouped by sibling key `(sender, nonce key, nonce seq)`: one promotion per
 *   group, because the members share a nonce; independent groups are promoted independently;
 * - a transient promotion failure is retried with exponential backoff; a terminal one (mined with a
 *   failed frame, or nonce already consumed) marks the entry failed and evicts its siblings.
 */
export class ParkIndexer {
  private timer?: NodeJS.Timeout;
  private busy = false;
  /** When this node first saw each template's latch settled (wall-clock ms). */
  private readonly settledAt = new Map<string, number>();
  private readonly options: Required<Omit<IndexerOptions, "promoteFn" | "clock">>;
  private readonly promoteFn: PromoteFn;
  private readonly clock: () => number;

  constructor(
    private readonly store: ParkStore,
    private readonly templates: Template[],
    private readonly reader: ChainReader,
    options: IndexerOptions
  ) {
    this.options = {
      primary: options.primary,
      fallbackAfterMs: options.fallbackAfterMs,
      retryBaseMs: options.retryBaseMs ?? 2_000,
      retryMaxMs: options.retryMaxMs ?? 60_000,
    };
    this.promoteFn = options.promoteFn ?? defaultPromote;
    this.clock = options.clock ?? Date.now;
  }

  start(intervalMs = 1000): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;

    try {
      const now = await this.reader.now();

      for (const template of this.templates) {
        for (const entry of this.parked(template)) {
          if (entry.expiry <= now) {
            this.store.setStatus(entry.id, "expired", { error: "PARK-040 expiry passed" });
          }
        }

        const live = this.parked(template);
        if (!live.length) continue;

        const state = await this.reader.readLatchState(template.latch, template.eventId);
        if (state === 0) continue;

        if (!this.settledAt.has(template.kind)) this.settledAt.set(template.kind, this.clock());

        for (const loser of live.filter((entry) => entry.trigger.expectedTag !== state)) {
          this.store.setStatus(loser.id, "evicted", { error: `latch state ${state}` });
        }

        const matching = live.filter((entry) => entry.trigger.expectedTag === state);
        if (!matching.length) continue;
        if (!this.mayPromote(template)) continue;

        const groups = new Map<string, ParkedEntry[]>();
        for (const entry of matching) {
          const key = siblingKey(entry.sender, entry.nonceKey, entry.nonceSeq);
          groups.set(key, [...(groups.get(key) ?? []), entry]);
        }

        for (const group of groups.values()) {
          await this.promoteGroup(group);
        }
      }
    } finally {
      this.busy = false;
    }
  }

  /** What a dashboard needs to show the promotion policy: role, fallback delay, and settle times. */
  snapshot(): { primary: boolean; fallbackAfterMs: number; settledAt: Record<string, number> } {
    return {
      primary: this.options.primary,
      fallbackAfterMs: this.options.fallbackAfterMs,
      settledAt: Object.fromEntries(this.settledAt),
    };
  }

  private parked(template: Template): ParkedEntry[] {
    return this.store.list("parked").filter((entry) => entry.kind === template.kind);
  }

  private mayPromote(template: Template): boolean {
    if (this.options.primary) return true;
    const settled = this.settledAt.get(template.kind);
    return settled !== undefined && this.clock() - settled >= this.options.fallbackAfterMs;
  }

  private async promoteGroup(group: ParkedEntry[]): Promise<void> {
    group.sort((a, b) => a.receivedAt - b.receivedAt);
    const winner = group.find((entry) => (entry.nextAttemptAt ?? 0) <= this.clock());
    if (!winner) return;

    const evictOthers = (reason: string) => {
      for (const sibling of group) {
        if (sibling.id !== winner.id) this.store.setStatus(sibling.id, "evicted", { error: reason });
      }
    };

    try {
      await this.promoteFn(winner, this.store);
      evictOthers("sibling already promoted");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof PromotionError && error.terminal) {
        this.store.setStatus(winner.id, "failed", { error: message });
        evictOthers("nonce key consumed");
        return;
      }

      const attempts = (winner.attempts ?? 0) + 1;
      const delay = Math.min(this.options.retryBaseMs * 2 ** (attempts - 1), this.options.retryMaxMs);
      this.store.setStatus(winner.id, "parked", {
        error: message,
        attempts,
        nextAttemptAt: this.clock() + delay,
      });
    }
  }
}
