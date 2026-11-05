# Trellis

Trellis is a rule and reference implementation for **latch-triggered parked frame transactions** on
the EIP-8141 / ERC-8421 alt-mempool. A signed frame transaction waits in a park node until a
write-once latch changes, then is promoted and submitted. The signer does not need to be online at
the moment the condition becomes true.

## 1. The gap

EIP-8141 makes validation programmable: a frame transaction can read state, approve execution and
payment, and carry one or more sender frames. The mempool still has two states: a transaction is
accepted or rejected. A transaction whose validation is correct only after an event has no state in
between.

That leaves conditional actions with three unsatisfactory options:

- **A keeper** re-signs and submits when the condition is true. The keeper has discretion, needs the
  key or a delegated signer, and can charge rent.
- **A deployed escrow** holds the funds and settles when a party or oracle calls it. It works, but
  it is a public contract, a deployment, and a custody surface.
- **A canonical transaction** can be submitted by the signer at the right time. The signer must be
  online; a deadman switch, an inheritance, or a key-loss rescue fails exactly when nobody is online.

The missing state is **parked**: the signed bytes are held, the condition is watched, and the
transaction is promoted only when the condition is true.

## 2. The PARK rule

PARK is a node policy draft, not a consensus change. The reference node enforces it; the rule is the
contribution.

**PARK-010 — Declared trigger.** The `self_verify` frame's data contains
`(latch, eventId, expectedTag)`. The signature covers the frame data. A parked transaction has no
implicit or out-of-band trigger.

**PARK-020 — Staked entity.** The transaction sender is a staked entity. The trigger read is a
foreign-state read inside `self_verify`, which the canonical mempool does not admit; the standard
alt-mempool admits it for a staked sender. The park node checks the stake before it parks.

**PARK-030 — Template binding.** The node admits only an allow-listed code hash. It reads the
account's `latch` and `eventId`, recomputes the signature hash from the signed bytes, verifies every
signature entry against the template's signers, and checks the declared trigger against the account.
It does not trust the submitter and does not use state overrides.

**PARK-040 — Expiry.** Every parked transaction carries an `expiry_verify` frame with an upper bound.
The node drops it after the bound. The promoted transaction is revalidated against the current head.

**PARK-050 — Caps.** Each node enforces a per-entity parked cap and a per-trigger cap. The caps are
live policy, not a consensus rule. They bound the parked state an entity or a trigger can occupy. A
node rejects entry P+1 for one trigger, not just at the end of a bundle.

**PARK-060 — Promotion and eviction.** Entries are indexed by
`(latch, eventId, expectedTag)`. When the latch changes, the node promotes entries whose tag matches
and evicts the rest without simulating the losers. A loser is not “probably invalid”; the node does
not spend gas on it. One promotion per sibling group.

**PARK-070 — Sibling exception.** Mutually exclusive values of one slot (YES/NO/REFUND, or several
rescue variants of one key) may be held together in the park area even though the live mempool only
accepts one. The park area is not the live mempool; the exception applies only to the parked set. The
live mempool sees the promoted value, never the siblings.

**PARK-080 — Gossip (optional).** A node may gossip a parked transaction to peers. Peers revalidate
independently. Gossip is optional for correctness; it costs privacy because the trigger and timing
leak. The rule does not require a global shared park.

## 3. Workload 1 — the deadman rescue

The first workload is a deadman switch with no owner online at the trigger.

- The owner deploys a `Latch` with an interval and a `RescueAccount` with a pre-committed beneficiary.
- The owner pings the latch while alive. `ping` updates the deadline.
- The owner pre-signs a rescue frame transaction:
  `[expiry_verify(deadline), self_verify(trigger = EXPIRED), SENDER(beneficiary, rescueAmount)]`.
  The account keeps a gas buffer.
- The park node accepts it while the latch is `UNSET`; the account's `self_verify` would fail now,
  so the transaction is not admitted to the live mempool.
- The owner stops pinging. After the interval plus grace, anyone calls `expire`; the latch becomes
  `EXPIRED`, write-once.
- The park node sees the change, promotes the rescue, and the beneficiary is paid. The owner was never
  online at the trigger; no keeper re-signed or chose the beneficiary.

A single account could mirror the latch in its own storage and run canonically. The demo uses a
shared latch; the alt-mempool lets one latch write cover many rescues and lets the park node promote
the matching ones. The nobody-online case is the clean proof that the alt-mempool adds a capability,
not just a cheaper path.

## 4. Workload 2 — the binary DLC

The second workload is a binary DLC between Alice and Bob.

- A `DLCAccount` holds both deposits and names the two parties, a latch, and fixed payouts.
- All cheques use one shared EIP-8250 key `K` at sequence 0: `CET_YES`, `CET_NO`, `CET_REFUND`.
- Each cheque carries both signatures, a trigger `(latch, eventId, expectedTag)`, an
  `expiry_verify` frame, and the payout `SENDER` frames.
- The park node holds the cheques while the latch is `UNSET`; the live alt-mempool would accept only
  one, and the canonical mempool would need the latch mirrored in the account's own storage.
- The oracle attests `YES` or `NO`; the matching cheque is promoted. The other values of `K` are
  invalid once the promoted cheque lands; the node evicts them without simulation.
- If the deadline passes with no attestation, `expire` sets `EXPIRED`; the refund is promoted. If only
  one party funded, an abort refund is valid for the recorded deposit.

The DLC is the mutual-exclusion test: one shared key, one latch, one winner, no per-contract poke. A
single DLC can be run canonically; the alt-mempool's contribution is the shared latch, the promoted
sibling, and the zero-simulation eviction of the losing values.

## 5. Reference implementation

The repo contains:

- **Contracts** — `Latch`, `RescueAccount`, `DLCAccount`, written in Solidity on
  `HegotaSupport(Devnet.ERC8421_WORKSHOP)`. `self_verify` reads the latch, checks the signers and the
  tag, checks the payout room, and approves execution and payment. The accounts are staked, so the
  foreign latch read is admitted by the alt-mempool.
- **Frame codec** — `@forshtat/hegota-support` for the EIP-8141/8250/8272 encoding; a minimal
  frame-tx build/send layer, with two signature entries for the DLC.
- **Park node** — a TypeScript service with two nodes. Node A accepts and gossips; node B
  independently revalidates the template, signatures, stake, expiry, and caps. Both nodes enforce the
  live per-trigger cap; the demo shows node B rejecting P+1.
- **Demo scripts** — the deadman rescue, the binary DLC, the cap, and the measurement. The gas comes
  from the receipt's `frameReceipts[0].gasUsed` or `ethrex_simulateFrameTransaction`, never from the
  admission report.

## 6. Why the alt-mempool

The rule needs four things the canonical mempool does not provide together:

1. A staked account may read foreign state inside `self_verify`; the canonical mempool refuses the
   read.
2. Multiple signed values can be held off-chain and promoted later; the canonical mempool is
   pass-or-reject.
3. A parked transaction can be revalidated at promotion against the current head; the canonical
   mempool validates on submission only.
4. A node can enforce a live per-trigger cap and a zero-simulation eviction; a plain RPC relay cannot.

## 7. Who it serves

- **Users with liveness-sensitive actions** — deadman switches, inheritance, key-loss rescue, and
  any action that must happen when the owner is offline.
- **Two-party binary outcomes** — a shared latch and one winning cheque, without a public settle or a
  per-contract poke.
- **Node operators** — a rule for a third state, a template allow-list, and a cap that bounds parked
  state.
- **The ecosystem** — a concrete rule draft and a reference implementation that can be tested against
  the EIP-8141 / ERC-8421 alt-mempool.

## 8. Scope and limitations

- The latch and the oracle are trust points. The rule does not make them trustless.
- The park node is a reference relay, not a sidecar feature. The rule is the product; the node is the
  proof.
- The DLC is a minimal 2-of-2 account. It is not a general DLC protocol.
- The winner can still submit after the trigger. The rule makes the losers invalid once the winner
  lands; it does not guarantee the winner is first.
- A single DLC can be done canonically. The rule targets shared latches, nobody-online triggers, and
  sibling sets.
- Gossip leaks the trigger and the timing. The repo makes no privacy claim.
- The implementation is devnet-only and unaudited.

## 9. Prior art

- Dryja, *Discreet Log Contracts* (2017), and the DLC specification.
- Pisa, *Accountable Watchtowers* (2019), for the watch-and-respond pattern.
- ERC-4337 staked entities for foreign-state reads.
- Base validity and other validity-based conditional submission work.
- ERC-8421 / EIP-8141 for the frame transaction and the alt-mempool.

The gap this repo fills is a **rule draft and reference implementation for latch-triggered parked
transactions**, with independent two-node admission, a live per-trigger cap, and zero-simulation
eviction of losing siblings. No native Ethereum DLC surfaced in our search; the repo is not claiming
that DLCs do not exist elsewhere.

## 10. Demo

```sh
npm run build:contracts
npm run deploy
npm run park:a
npm run park:b
npm run demo:deadman
npm run demo:dlc
npm run demo:cap
npm run measure
```

The demo prints the latch address, the parked entries, the promotion, the admission result, the
receipt, the explorer link, and the measured gas. The deadman rescue is rejected before `expire` and
accepted after; the DLC's losing values are evicted without simulation; node B rejects P+1.

## 11. Status

Reference implementation on devnet 1337. Contracts are unaudited. The rule is a draft for discussion,
not a consensus proposal.
