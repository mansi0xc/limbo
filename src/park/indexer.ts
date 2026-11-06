import type { ParkStore } from "./store.js";
import { promote as defaultPromote, type PromotionResult } from "./promoter.js";
import type { ChainReader, ParkedEntry, Template } from "./types.js";

export type PromoteFn = (entry: ParkedEntry, store: ParkStore) => Promise<PromotionResult>;

/**
 * Watches each latch and applies PARK-060:
 *
 * - entries whose tag matches the new state are promoted (the promoter node) or left for the peer;
 * - entries whose tag does not match are evicted without simulation;
 * - one promotion per sibling group, because the siblings share the same nonce key.
 *
 * The latch state is recorded only after a successful promotion, so a failed promotion is retried
 * on the next tick instead of being skipped forever.
 */
export class ParkIndexer {
  private timer?: NodeJS.Timeout;
  private busy = false;
  private readonly lastState = new Map<string, number>();

  constructor(
    private readonly store: ParkStore,
    private readonly templates: Template[],
    private readonly reader: ChainReader,
    private readonly promotionEnabled: boolean,
    private readonly promoteFn: PromoteFn = defaultPromote
  ) {}

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
        const parked = this.store
          .list("parked")
          .filter((entry) => entry.kind === template.kind);

        if (!parked.length) continue;

        for (const entry of parked) {
          if (entry.expiry <= now) {
            this.store.setStatus(entry.id, "expired", { error: "PARK-040 expiry passed" });
          }
        }

        const live = this.store.list("parked").filter((entry) => entry.kind === template.kind);
        if (!live.length) continue;

        const state = await this.reader.readLatchState(template.latch, template.eventId);
        if (state === 0) continue;

        const previous = this.lastState.get(template.kind);
        if (previous === state) continue;

        const matching = live.filter((entry) => entry.trigger.expectedTag === state);
        const losers = live.filter((entry) => entry.trigger.expectedTag !== state);

        for (const loser of losers) {
          this.store.setStatus(loser.id, "evicted", { error: `latch state ${state}` });
        }

        if (!this.promotionEnabled || matching.length === 0) {
          this.lastState.set(template.kind, state);
          continue;
        }

        matching.sort((a, b) => a.receivedAt - b.receivedAt);
        const winner = matching[0];

        try {
          await this.promoteFn(winner, this.store);
          this.lastState.set(template.kind, state);
          for (const sibling of matching.slice(1)) {
            this.store.setStatus(sibling.id, "evicted", { error: "sibling already promoted" });
          }
        } catch (error) {
          this.store.setStatus(winner.id, "parked", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
