import { describe, expect, it } from "vitest";
import { keccak256, toBytes, type Address, type Hex } from "viem";
import type { FrameTransaction } from "../src/frameTx/types.js";
import { ParkIndexer } from "../src/park/indexer.js";
import { ParkStore } from "../src/park/store.js";
import type { ChainReader, ParkedEntry, Template } from "../src/park/types.js";

const LATCH = "0x1111111111111111111111111111111111111111" as Address;
const ACCOUNT = "0x2222222222222222222222222222222222222222" as Address;
const EVENT = keccak256(toBytes("indexer")) as Hex;
const CODE_HASH = keccak256(toBytes("code")) as Hex;

function entry(): ParkedEntry {
  return {
    id: "a",
    kind: "rescue",
    tx: {} as FrameTransaction,
    trigger: { latch: LATCH, eventId: EVENT, expectedTag: 3 },
    sender: ACCOUNT,
    nonceKey: 1n,
    nonceSeq: 0n,
    expiry: 2000n,
    codeHash: CODE_HASH,
    signers: [],
    status: "parked",
    receivedAt: 0,
  };
}

describe("ParkIndexer", () => {
  it("retries a failed promotion instead of skipping the state forever", async () => {
    const store = new ParkStore();
    store.add(entry());

    const template: Template = {
      kind: "rescue",
      account: ACCOUNT,
      codeHash: CODE_HASH,
      latch: LATCH,
      eventId: EVENT,
      allowedTags: [3],
      signers: [],
    };

    const reader: ChainReader = {
      readCodeHash: async () => CODE_HASH,
      readStake: async () => ({ amount: 1n, unstakeDelay: 0, withdrawTime: 0 }),
      readLatchState: async () => 3,
      readLatchDeadline: async () => 1000n,
      readLatchGrace: async () => 10,
      now: async () => 1000n,
    };

    let calls = 0;
    const indexer = new ParkIndexer(store, [template], reader, true, async (parked, parkStore) => {
      calls++;
      if (calls === 1) throw new Error("promotion failed");
      parkStore.setStatus(parked.id, "promoted", { txHash: "0xdead", gasUsed: 1n, includedBlock: 1n });
      return { hash: "0xdead", gasUsed: 1n, block: 1n };
    });

    await indexer.tick();
    expect(calls).toBe(1);
    expect(store.get("a")?.status).toBe("parked");
    expect(store.get("a")?.error).toContain("promotion failed");

    await indexer.tick();
    expect(calls).toBe(2);
    expect(store.get("a")?.status).toBe("promoted");

    await indexer.tick();
    expect(calls).toBe(2);
  });
});
