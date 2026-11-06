import { randomUUID } from "node:crypto";
import {
  concat,
  decodeAbiParameters,
  hexToBigInt,
  isAddressEqual,
  numberToHex,
  recoverAddress,
  type Address,
  type Hex,
} from "viem";
import { config } from "../config.js";
import { computeSigHash } from "../frameTx/codec.js";
import { FRAME_MODE, type FrameTransaction } from "../frameTx/types.js";
import { triggerKey } from "./store.js";
import type { ParkStore } from "./store.js";
import type { ChainReader, ParkedEntry, Template, Trigger, Validation } from "./types.js";

const reject = (rule: string, reason: string): Validation => ({ ok: false, rule, reason });
const EXPIRY_MARGIN_SECONDS = 60n;

/**
 * Template-bound admission. The node never trusts the submitter:
 *
 * 1. the sender is an allow-listed account with the expected code hash;
 * 2. the signed self_verify data declares the latch, event and tag;
 * 3. the declared trigger matches the signed data and the template;
 * 4. the expiry frame is present and outlives the latch deadline;
 * 5. the latch is unset and the sender is staked;
 * 6. every signature recovers to a template signer;
 * 7. the live per-entity and per-trigger caps still have room.
 */
export async function validate(
  tx: FrameTransaction,
  declared: Trigger,
  templates: Template[],
  store: ParkStore,
  reader: ChainReader,
  nowOverride?: bigint
): Promise<Validation> {
  const template = templates.find((candidate) => isAddressEqual(candidate.account, tx.sender));
  if (!template) return reject("PARK-030", "sender has no allow-listed template");

  if (tx.chainId !== BigInt(config.chainId)) return reject("PARK-030", "wrong chain id");

  const codeHash = await reader.readCodeHash(tx.sender);
  if (codeHash.toLowerCase() !== template.codeHash.toLowerCase()) {
    return reject("PARK-030", "sender code hash does not match the template");
  }

  const self = tx.frames.find(
    (frame) => frame.mode === FRAME_MODE.VERIFY && (frame.target === null || isAddressEqual(frame.target, tx.sender))
  );
  if (!self) return reject("PARK-010", "missing self_verify frame");

  let decoded: readonly [Address, Hex, number];
  try {
    decoded = decodeAbiParameters(
      [{ type: "address" }, { type: "bytes32" }, { type: "uint8" }],
      self.data
    ) as readonly [Address, Hex, number];
  } catch {
    return reject("PARK-010", "self_verify data is not a trigger");
  }

  const trigger: Trigger = {
    latch: decoded[0],
    eventId: decoded[1],
    expectedTag: Number(decoded[2]),
  };

  if (!isAddressEqual(trigger.latch, template.latch)) {
    return reject("PARK-030", "trigger latch is not the template latch");
  }
  if (trigger.eventId.toLowerCase() !== template.eventId.toLowerCase()) {
    return reject("PARK-030", "trigger event is not the template event");
  }
  if (!template.allowedTags.includes(trigger.expectedTag)) {
    return reject("PARK-010", "trigger tag is not allowed for this template");
  }
  if (
    !declared ||
    !isAddressEqual(declared.latch, trigger.latch) ||
    declared.eventId.toLowerCase() !== trigger.eventId.toLowerCase() ||
    declared.expectedTag !== trigger.expectedTag
  ) {
    return reject("PARK-010", "declared trigger does not match the signed trigger");
  }

  const expiryFrame = tx.frames.find(
    (frame) =>
      frame.mode === FRAME_MODE.VERIFY &&
      frame.target !== null &&
      isAddressEqual(frame.target, config.expiryVerifier)
  );
  if (!expiryFrame || expiryFrame.data.length !== 18) {
    return reject("PARK-040", "missing or malformed expiry_verify frame");
  }

  const expiry = hexToBigInt(expiryFrame.data);
  const now = nowOverride ?? (await reader.now());
  if (expiry <= now) return reject("PARK-040", "cheque has already expired");

  const deadline = await reader.readLatchDeadline(template.latch, template.eventId);
  if (deadline === 0n) return reject("PARK-040", "latch has no deadline");
  const grace = await reader.readLatchGrace(template.latch);
  if (expiry <= deadline + BigInt(grace) + EXPIRY_MARGIN_SECONDS) {
    return reject("PARK-040", "expiry is inside the latch grace window");
  }

  const latchState = await reader.readLatchState(template.latch, template.eventId);
  if (latchState !== 0) return reject("PARK-010", "latch is already settled");

  const stake = await reader.readStake(tx.sender);
  if (stake.amount < config.minStake || stake.withdrawTime !== 0) {
    return reject("PARK-020", "sender is not staked");
  }

  if (tx.signatures.length !== template.signers.length) {
    return reject("PARK-030", "signature count does not match the template");
  }

  const sigHash = computeSigHash(tx);
  for (let i = 0; i < template.signers.length; i++) {
    const signature = tx.signatures[i]?.signature;
    if (!signature || signature.length !== 132) {
      return reject("PARK-030", `missing signature ${i}`);
    }

    const v = Number.parseInt(signature.slice(2, 4), 16);
    const r = `0x${signature.slice(4, 68)}` as Hex;
    const s = `0x${signature.slice(68, 132)}` as Hex;

    let recovered: Address;
    try {
      recovered = await recoverAddress({
        hash: sigHash,
        signature: concat([r, s, numberToHex(27 + v, { size: 1 })]),
      });
    } catch {
      return reject("PARK-030", `signature ${i} is malformed`);
    }

    if (!isAddressEqual(recovered, template.signers[i])) {
      return reject("PARK-030", `signature ${i} is not a template signer`);
    }
  }

  if (tx.nonceKeys.length !== 1) return reject("PARK-060", "expected exactly one nonce key");
  if (store.countByTrigger(trigger) >= config.pCap) {
    return reject("PARK-050", `per-trigger cap ${config.pCap} reached`);
  }
  if (store.countByEntity(tx.sender) >= config.eCap) {
    return reject("PARK-050", `per-entity cap ${config.eCap} reached`);
  }

  const entry: ParkedEntry = {
    id: randomUUID(),
    kind: template.kind,
    tx,
    trigger,
    sender: tx.sender,
    nonceKey: tx.nonceKeys[0],
    nonceSeq: tx.nonceSeq,
    expiry,
    codeHash,
    signers: template.signers,
    status: "parked",
    receivedAt: Date.now(),
  };

  store.add(entry);
  return {
    ok: true,
    rule: "PARK-060",
    reason: `parked under ${triggerKey(trigger)}`,
    entry,
  };
}
