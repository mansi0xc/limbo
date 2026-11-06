import { encodeFunctionData } from "viem";
import { config } from "./config.js";
import { loadArtifact, type ArtifactName } from "./contracts.js";
import { buildLatchedTx, signLatchedTx } from "./frameTx/build.js";
import type { FrameTransaction } from "./frameTx/types.js";
import { requireState } from "./state.js";
import type { Trigger } from "./park/types.js";

export interface Cheque {
  tx: FrameTransaction;
  trigger: Trigger;
}

export type DlcCheques = {
  yes: Cheque;
  no: Cheque;
  refund: Cheque;
};

/** A zero-value SENDER frame that calls a no-argument marker function on the account itself. */
export function selfCall(account: `0x${string}`, artifact: ArtifactName, functionName: string) {
  return {
    to: account,
    data: encodeFunctionData({ abi: loadArtifact(artifact).abi, functionName }),
  };
}

export async function buildRescue(): Promise<Cheque> {
  const trigger: Trigger = {
    latch: requireState("rescueLatch"),
    eventId: requireState("rescueEventId"),
    expectedTag: 3,
  };

  const tx = buildLatchedTx({
    sender: requireState("rescueAccount"),
    signers: [requireState("owner")],
    trigger,
    expiry: BigInt(requireState("rescueExpiry")),
    calls: [selfCall(requireState("rescueAccount"), "RescueAccount", "markRescued")],
    payouts: [{ to: requireState("beneficiary"), value: config.rescue.amount }],
    nonceKey: 1n,
    nonceSeq: 0n,
  });

  return {
    tx: await signLatchedTx(tx, [requireState("ownerKey")]),
    trigger,
  };
}

export async function buildDlc(): Promise<DlcCheques> {
  const sender = requireState("dlcAccount");
  const latch = requireState("dlcLatch");
  const eventId = requireState("dlcEventId");
  const expiry = BigInt(requireState("dlcExpiry"));
  const alice = requireState("alice");
  const bob = requireState("bob");
  const signers = [alice, bob];
  const keys = [requireState("aliceKey"), requireState("bobKey")];

  const build = async (expectedTag: number, payouts: { to: `0x${string}`; value: bigint }[]): Promise<Cheque> => {
    const trigger: Trigger = { latch, eventId, expectedTag };
    const tx = buildLatchedTx({
      sender,
      signers,
      trigger,
      expiry,
      payouts,
      nonceKey: 1n,
      nonceSeq: 0n,
    });

    return { tx: await signLatchedTx(tx, keys), trigger };
  };

  return {
    yes: await build(1, [{ to: alice, value: config.dlc.payoutA + config.dlc.payoutB }]),
    no: await build(2, [{ to: bob, value: config.dlc.payoutA + config.dlc.payoutB }]),
    refund: await build(3, [
      { to: alice, value: config.dlc.deposit },
      { to: bob, value: config.dlc.deposit },
    ]),
  };
}

export async function buildAbort(depositor: "alice" | "bob"): Promise<Cheque> {
  const sender = requireState("dlcAccount");
  const trigger: Trigger = {
    latch: requireState("dlcLatch"),
    eventId: requireState("dlcEventId"),
    expectedTag: 4,
  };

  const tx = buildLatchedTx({
    sender,
    signers: [requireState(depositor)],
    trigger,
    expiry: BigInt(requireState("dlcExpiry")),
    // The account refuses an ABORT cheque with any SENDER frame other than zero-value self-calls, so the
    // abort only marks the account; each party then pulls its own deposit with `claim()`.
    calls: [selfCall(sender, "DLCAccount", "markAborted")],
    payouts: [],
    nonceKey: 1n,
    nonceSeq: 0n,
  });

  const key = depositor === "alice" ? requireState("aliceKey") : requireState("bobKey");
  return { tx: await signLatchedTx(tx, [key]), trigger };
}
