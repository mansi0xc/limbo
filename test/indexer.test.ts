import { describe, expect, it } from "vitest";
import { keccak256, toBytes, type Address, type Hex } from "viem";
import type { FrameTransaction } from "../src/frameTx/types.js";
import { ParkIndexer, type PromoteFn } from "../src/park/indexer.js";
import { PromotionError } from "../src/park/promoter.js";
import { ParkStore } from "../src/park/store.js";
import type { ChainReader, ParkedEntry, Template } from "../src/park/types.js";

const LATCH = "0x1111111111111111111111111111111111111111" as Address;
const ACCOUNT = "0x2222222222222222222222222222222222222222" as Address;
const EVENT = keccak256(toBytes("indexer")) as Hex;
const CODE_HASH = keccak256(toBytes("code")) as Hex;

function entry(id = "a", tag = 3, nonceKey = 1n, receivedAt = 0): ParkedEntry {
  return {
    id,
    txId: keccak256(toBytes(`tx-${id}`)),
    kind: "rescue",
    tx: {} as FrameTransaction,
    trigger: { latch: LATCH, eventId: EVENT, expectedTag: tag },
    sender: ACCOUNT,
    nonceKey,
    nonceSeq: 0n,
    expiry: 2000n,
    codeHash: CODE_HASH,
    signers: [],
    status: "parked",
    receivedAt,
  };
}

const template: Template = {
  kind: "rescue",
  account: ACCOUNT,
  codeHash: CODE_HASH,
  latch: LATCH,
  eventId: EVENT,
  allowedTags: [1, 2, 3],
  signers: [],
};

function reader(state = 3): ChainReader {
  return {
    readCodeHash: async () => CODE_HASH,
    readStake: async () => ({ amount: 1n, unstakeDelay: 0, withdrawTime: 0 }),
    readLatchState: async () => state,
    readLatchDeadline: async () => 1000n,
    readLatchGrace: async () => 10,
    now: async () => 1000n,
  };
}

const landed: PromoteFn = async (parked, store) => {
  store.setStatus(parked.id, "promoted", { txHash: "0xdead", gasUsed: 1n, includedBlock: 1n });
  return { hash: "0xdead", gasUsed: 1n, block: 1n };
};

describe("ParkIndexer", () => {
  it("retries a transient failure with exponential backoff", async () => {
    const store = new ParkStore();
    store.add(entry());

    let clock = 0;
    let calls = 0;
    const indexer = new ParkIndexer(store, [template], reader(), {
      primary: true,
      fallbackAfterMs: 30_000,
      retryBaseMs: 1_000,
      clock: () => clock,
      promoteFn: async (parked, parkStore) => {
        calls++;
        if (calls <= 2) throw new Error("gateway timeout");
        return landed(parked, parkStore);
      },
    });

    await indexer.tick();
    expect(calls).toBe(1);
    expect(store.get("a")?.status).toBe("parked");
    expect(store.get("a")?.nextAttemptAt).toBe(1_000);

    await indexer.tick();
    expect(calls).toBe(1); // still backing off

    clock = 1_000;
    await indexer.tick();
    expect(calls).toBe(2);
    expect(store.get("a")?.nextAttemptAt).toBe(3_000); // 2s after the second failure

    clock = 3_000;
    await indexer.tick();
    expect(calls).toBe(3);
    expect(store.get("a")?.status).toBe("promoted");

    await indexer.tick();
    expect(calls).toBe(3);
  });

  it("marks a terminal failure failed and evicts its siblings instead of retrying", async () => {
    const store = new ParkStore();
    store.add(entry("a", 3, 1n, 0));
    store.add(entry("b", 3, 1n, 1));

    let calls = 0;
    const indexer = new ParkIndexer(store, [template], reader(), {
      primary: true,
      fallbackAfterMs: 0,
      promoteFn: async () => {
        calls++;
        throw new PromotionError("transaction 0x.. was mined but frame(s) 3 failed", true);
      },
    });

    await indexer.tick();
    await indexer.tick();
    expect(calls).toBe(1);
    expect(store.get("a")?.status).toBe("failed");
    expect(store.get("b")?.status).toBe("evicted");
    expect(store.get("b")?.error).toContain("nonce key consumed");
  });

  it("promotes one entry per sibling group and leaves independent groups alone", async () => {
    const store = new ParkStore();
    store.add(entry("a", 3, 1n, 0)); // group key 1
    store.add(entry("b", 3, 1n, 1)); // sibling of a
    store.add(entry("c", 3, 2n, 2)); // independent key 2
    store.add(entry("d", 1, 1n, 3)); // wrong tag

    const promoted: string[] = [];
    const indexer = new ParkIndexer(store, [template], reader(3), {
      primary: true,
      fallbackAfterMs: 0,
      promoteFn: async (parked, parkStore) => {
        promoted.push(parked.id);
        return landed(parked, parkStore);
      },
    });

    await indexer.tick();
    expect(promoted.sort()).toEqual(["a", "c"]);
    expect(store.get("b")?.status).toBe("evicted");
    expect(store.get("b")?.error).toContain("sibling");
    expect(store.get("c")?.status).toBe("promoted");
    expect(store.get("d")?.status).toBe("evicted");
    expect(store.get("d")?.error).toContain("latch state 3");
  });

  it("lets a non-primary node promote only after the fallback delay", async () => {
    const store = new ParkStore();
    store.add(entry());

    let clock = 10_000;
    let calls = 0;
    const indexer = new ParkIndexer(store, [template], reader(), {
      primary: false,
      fallbackAfterMs: 30_000,
      clock: () => clock,
      promoteFn: async (parked, parkStore) => {
        calls++;
        return landed(parked, parkStore);
      },
    });

    await indexer.tick();
    expect(calls).toBe(0);

    clock = 39_999;
    await indexer.tick();
    expect(calls).toBe(0);

    clock = 40_000;
    await indexer.tick();
    expect(calls).toBe(1);
    expect(store.get("a")?.status).toBe("promoted");
  });
});
