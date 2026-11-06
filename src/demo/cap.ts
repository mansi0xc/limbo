import { config } from "../config.js";
import { buildLatchedTx, signLatchedTx } from "../frameTx/build.js";
import type { Trigger } from "../park/types.js";
import { nodeStatus, park } from "../sign.js";
import { requireState } from "../state.js";

async function main(): Promise<void> {
  const trigger: Trigger = {
    latch: requireState("rescueLatch"),
    eventId: requireState("rescueEventId"),
    expectedTag: 3,
  };

  console.log(`per-trigger cap P=${config.pCap}; submitting P+1 rescue cheques to node A`);

  const cheques = [];
  for (let i = 1; i <= config.pCap + 1; i++) {
    const tx = buildLatchedTx({
      sender: requireState("rescueAccount"),
      signers: [requireState("owner")],
      trigger,
      expiry: BigInt(requireState("rescueExpiry")),
      payouts: [{ to: requireState("beneficiary"), value: config.rescue.amount }],
      nonceKey: BigInt(i),
      nonceSeq: 0n,
    });
    const signed = await signLatchedTx(tx, [requireState("ownerKey")]);
    const result = await park({ tx: signed, trigger }, config.ports.a);
    console.log(`  ${i}: ${result.ok ? "accepted" : "rejected"} ${result.rule} ${result.reason}`);
    if (result.peer) {
      console.log(`     peer: ${result.peer.ok ? "accepted" : "rejected"} ${result.peer.rule} ${result.peer.reason}`);
    }
    cheques.push(signed);
  }

  console.log("direct P+1 to node B, which already has the first P from gossip");
  const overflow = await park({ tx: cheques[config.pCap], trigger }, config.ports.b);
  console.log(`  node B: ${overflow.ok ? "accepted" : "rejected"} ${overflow.rule} ${overflow.reason}`);

  const a = await nodeStatus(config.ports.a);
  const b = await nodeStatus(config.ports.b);
  console.log("");
  console.log(`node A parked=${a.counts?.parked} promoted=${a.counts?.promoted} evicted=${a.counts?.evicted}`);
  console.log(`node B parked=${b.counts?.parked} promoted=${b.counts?.promoted} evicted=${b.counts?.evicted}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
