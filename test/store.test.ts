import { describe, expect, it } from "vitest";
import { keccak256, toBytes, type Address, type Hex } from "viem";
import type { FrameTransaction } from "../src/frameTx/types.js";
import { ParkStore, siblingKey, triggerKey } from "../src/park/store.js";
import type { ParkedEntry, Trigger } from "../src/park/types.js";

const LATCH = "0x1111111111111111111111111111111111111111" as Address;
const ACCOUNT = "0x2222222222222222222222222222222222222222" as Address;
const EVENT = keccak256(toBytes("store")) as Hex;

const trigger = (tag: number): Trigger => ({ latch: LATCH, eventId: EVENT, expectedTag: tag });

function entry(id: string, tag = 3, key = 1n, status: ParkedEntry["status"] = "parked"): ParkedEntry {
  return {
    id,
    kind: "rescue",
    tx: {} as FrameTransaction,
    trigger: trigger(tag),
    sender: ACCOUNT,
    nonceKey: key,
    nonceSeq: 0n,
    expiry: 1000n,
    codeHash: "0x" as Hex,
    signers: [],
    status,
    receivedAt: 0,
  };
}

describe("ParkStore", () => {
  it("indexes by trigger, entity and sibling group", () => {
    const store = new ParkStore();
    store.add(entry("a", 3, 1n));
    store.add(entry("b", 3, 2n));
    store.add(entry("c", 2, 1n));

    expect(store.countByTrigger(trigger(3))).toBe(2);
    expect(store.countByEntity(ACCOUNT)).toBe(3);
    expect(store.siblings(ACCOUNT, 1n, 0n).map((item) => item.id)).toEqual(["a", "c"]);
    expect(triggerKey(trigger(3))).toContain(":3");
    expect(siblingKey(ACCOUNT, 1n, 0n)).toContain(":1:0");
  });

  it("stops counting promoted entries against the caps", () => {
    const store = new ParkStore();
    store.add(entry("a"));
    store.add(entry("b", 3, 2n));

    expect(store.countByTrigger(trigger(3))).toBe(2);
    store.setStatus("a", "promoted", { txHash: "0xdead" as Hex });
    expect(store.countByTrigger(trigger(3))).toBe(1);
    expect(store.list("promoted")).toHaveLength(1);
  });
});
