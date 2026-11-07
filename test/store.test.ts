import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
    txId: keccak256(toBytes(`tx-${id}`)),
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

  it("finds a live duplicate by tx id until it leaves the live statuses", () => {
    const store = new ParkStore();
    const a = entry("a");
    store.add(a);
    expect(store.findLive(a.txId)?.id).toBe("a");
    store.setStatus("a", "promoted");
    expect(store.findLive(a.txId)?.id).toBe("a");
    store.setStatus("a", "evicted");
    expect(store.findLive(a.txId)).toBeUndefined();
  });

  it("persists entries with bigints and reloads the indexes", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "limbo-store-"));
    const file = path.join(dir, "a.json");
    const first = new ParkStore({ file });
    first.add(entry("a", 3, 1n));
    first.add(entry("b", 2, 1n));
    first.setStatus("b", "evicted", { error: "latch state 3" });

    const second = new ParkStore({ file });
    expect(second.list()).toHaveLength(2);
    expect(second.get("a")?.nonceKey).toBe(1n);
    expect(second.get("a")?.expiry).toBe(1000n);
    expect(second.get("b")?.status).toBe("evicted");
    expect(second.countByTrigger(trigger(3))).toBe(1);
    expect(second.siblings(ACCOUNT, 1n, 0n)).toHaveLength(2);
    expect(second.findLive(entry("a").txId)?.id).toBe("a");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
