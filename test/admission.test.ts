import { beforeEach, describe, expect, it } from "vitest";
import {
  generatePrivateKey,
  privateKeyToAccount,
} from "viem/accounts";
import { keccak256, toBytes, type Address, type Hex } from "viem";
import { config } from "../src/config.js";
import { buildLatchedTx, signLatchedTx } from "../src/frameTx/build.js";
import type { FrameTransaction } from "../src/frameTx/types.js";
import { validate } from "../src/park/admission.js";
import { ParkStore } from "../src/park/store.js";
import type { ChainReader, Template, Trigger } from "../src/park/types.js";

const LATCH = "0x1111111111111111111111111111111111111111" as Address;
const ACCOUNT = "0x2222222222222222222222222222222222222222" as Address;
const BENEFICIARY = "0x3333333333333333333333333333333333333333" as Address;
const EVENT = keccak256(toBytes("rescue")) as Hex;
const CODE_HASH = keccak256(toBytes("code")) as Hex;

const ownerKey = generatePrivateKey();
const otherKey = generatePrivateKey();
const aliceKey = generatePrivateKey();
const bobKey = generatePrivateKey();

const owner = privateKeyToAccount(ownerKey).address;
const other = privateKeyToAccount(otherKey).address;
const alice = privateKeyToAccount(aliceKey).address;
const bob = privateKeyToAccount(bobKey).address;

function reader(overrides: Partial<ChainReader> = {}): ChainReader {
  return {
    readCodeHash: async () => CODE_HASH,
    readStake: async () => ({ amount: config.minStake, unstakeDelay: 86400, withdrawTime: 0 }),
    readLatchState: async () => 0,
    readLatchDeadline: async () => 2000n,
    readLatchGrace: async () => 10,
    now: async () => 1000n,
    ...overrides,
  };
}

const rescueTemplate: Template = {
  kind: "rescue",
  account: ACCOUNT,
  codeHash: CODE_HASH,
  latch: LATCH,
  eventId: EVENT,
  allowedTags: [3],
  signers: [owner],
};

type BuildOptions = {
  signers?: Address[];
  tag?: number;
  expiry?: bigint;
  nonceKey?: bigint;
  nonceSeq?: bigint;
  latch?: Address;
  eventId?: Hex;
  declaredTag?: number;
  declaredLatch?: Address;
  declaredEventId?: Hex;
  template?: Template;
};

async function cheque(options: BuildOptions = {}): Promise<{ tx: FrameTransaction; declared: Trigger; template: Template }> {
  const template = options.template ?? rescueTemplate;
  const signers = options.signers ?? template.signers;
  const tag = options.tag ?? template.allowedTags[0];
  const latch = options.latch ?? template.latch;
  const eventId = options.eventId ?? template.eventId;

  const tx = buildLatchedTx({
    sender: template.account,
    signers,
    trigger: { latch, eventId, expectedTag: tag },
    expiry: options.expiry ?? 5000n,
    payouts: [{ to: BENEFICIARY, value: 1n }],
    nonceKey: options.nonceKey ?? 1n,
    nonceSeq: options.nonceSeq ?? 0n,
  });

  const keys = signers.map((signer) => {
    if (signer === owner) return ownerKey;
    if (signer === alice) return aliceKey;
    if (signer === bob) return bobKey;
    return otherKey;
  });

  const signed = await signLatchedTx(tx, keys);
  const declared: Trigger = {
    latch: options.declaredLatch ?? latch,
    eventId: options.declaredEventId ?? eventId,
    expectedTag: options.declaredTag ?? tag,
  };

  return { tx: signed, declared, template };
}

describe("park admission", () => {
  let store: ParkStore;

  beforeEach(() => {
    store = new ParkStore();
  });

  it("accepts a correctly signed rescue", async () => {
    const { tx, declared, template } = await cheque();
    const result = await validate(tx, declared, [template], store, reader(), 1000n);
    expect(result.ok).toBe(true);
    expect(result.rule).toBe("PARK-060");
    expect(store.countByTrigger(declared)).toBe(1);
  });

  it("rejects a signature from a non-template signer", async () => {
    const { tx, declared, template } = await cheque({ signers: [other] });
    const result = await validate(tx, declared, [template], store, reader(), 1000n);
    expect(result.ok).toBe(false);
    expect(result.rule).toBe("PARK-030");
  });

  it("rejects a tag the template does not allow", async () => {
    const { tx, declared, template } = await cheque({ tag: 2 });
    const result = await validate(tx, declared, [template], store, reader(), 1000n);
    expect(result.ok).toBe(false);
    expect(result.rule).toBe("PARK-010");
  });

  it("rejects a declared trigger that differs from the signed trigger", async () => {
    const { tx, declared, template } = await cheque({ declaredTag: 2 });
    const result = await validate(tx, declared, [template], store, reader(), 1000n);
    expect(result.ok).toBe(false);
    expect(result.rule).toBe("PARK-010");
  });

  it("rejects an unstaked sender", async () => {
    const { tx, declared, template } = await cheque();
    const result = await validate(
      tx,
      declared,
      [template],
      store,
      reader({ readStake: async () => ({ amount: 0n, unstakeDelay: 0, withdrawTime: 0 }) }),
      1000n
    );
    expect(result.ok).toBe(false);
    expect(result.rule).toBe("PARK-020");
  });

  it("rejects a settled latch", async () => {
    const { tx, declared, template } = await cheque();
    const result = await validate(tx, declared, [template], store, reader({ readLatchState: async () => 2 }), 1000n);
    expect(result.ok).toBe(false);
    expect(result.rule).toBe("PARK-010");
  });

  it("rejects an expired cheque", async () => {
    const { tx, declared, template } = await cheque({ expiry: 1500n });
    const result = await validate(tx, declared, [template], store, reader(), 2000n);
    expect(result.ok).toBe(false);
    expect(result.rule).toBe("PARK-040");
  });

  it("rejects a cheque whose expiry precedes the latch deadline", async () => {
    const { tx, declared, template } = await cheque({ expiry: 1500n });
    const result = await validate(tx, declared, [template], store, reader(), 1000n);
    expect(result.ok).toBe(false);
    expect(result.rule).toBe("PARK-040");
  });

  it("rejects a cheque that expires inside the latch grace window", async () => {
    const { tx, declared, template } = await cheque({ expiry: 2070n });
    const result = await validate(tx, declared, [template], store, reader(), 1000n);
    expect(result.ok).toBe(false);
    expect(result.rule).toBe("PARK-040");
  });

  it("accepts a cheque after the grace window plus the margin", async () => {
    const { tx, declared, template } = await cheque({ expiry: 2071n });
    const result = await validate(tx, declared, [template], store, reader(), 1000n);
    expect(result.ok).toBe(true);
    expect(result.rule).toBe("PARK-060");
  });

  it("enforces the live per-trigger cap", async () => {
    const template = rescueTemplate;
    for (let i = 0; i < config.pCap; i++) {
      const { tx, declared } = await cheque({ nonceKey: BigInt(i + 1) });
      const result = await validate(tx, declared, [template], store, reader(), 1000n);
      expect(result.ok).toBe(true);
    }

    const overflow = await cheque({ nonceKey: BigInt(config.pCap + 1) });
    const result = await validate(overflow.tx, overflow.declared, [template], store, reader(), 1000n);
    expect(result.ok).toBe(false);
    expect(result.rule).toBe("PARK-050");
    expect(store.countByTrigger(overflow.declared)).toBe(config.pCap);
  });

  it("holds mutually exclusive siblings in the park area", async () => {
    const template: Template = {
      kind: "dlc",
      account: ACCOUNT,
      codeHash: CODE_HASH,
      latch: LATCH,
      eventId: EVENT,
      allowedTags: [1, 2, 3],
      signers: [alice, bob],
    };

    const yes = await cheque({ template, tag: 1, nonceKey: 1n, nonceSeq: 0n });
    const no = await cheque({ template, tag: 2, nonceKey: 1n, nonceSeq: 0n });

    const first = await validate(yes.tx, yes.declared, [template], store, reader(), 1000n);
    const second = await validate(no.tx, no.declared, [template], store, reader(), 1000n);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(store.siblings(ACCOUNT, 1n, 0n)).toHaveLength(2);
  });
});
