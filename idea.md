# Trellis

Trellis is a reference implementation of **PARK**, a node policy that adds a **parked** state to the
EIP-8141 / ERC-8421 alt-mempool: a signed frame transaction waits until a write-once latch changes,
then the matching bytes are promoted. The rule is the product; the deadman rescue and the binary DLC
are the two proofs.

## How to read this document

The project has four layers. Keeping them separate is the difference between a coherent protocol and
a pile of features.

1. **The rule** — PARK. A third mempool state for latch-triggered transactions.
2. **The enforcement** — the two park nodes, template admission, the live cap, and zero-simulation
   eviction.
3. **The proofs** — the deadman rescue (nobody online) and the binary DLC (mutual exclusion).
4. **The delivery** — the contracts, tests, deploy scripts, docs, optional dashboard, and live run.

The deadman and the DLC are **not two products**. They are two different test cases for one rule:
one where the signer is offline, one where two parties compete for one key.

## 1. The gap

EIP-8141 makes validation programmable: a frame transaction can read state, approve execution and
payment, and carry one or more sender frames. The mempool still has two answers: accept or reject. A
transaction whose validation is correct only after an event has no state in between.

That leaves conditional actions with three unsatisfactory options:

- **A keeper** re-signs and submits when the condition is true. The keeper has discretion, needs the
  key or a delegated signer, and can charge rent.
- **A deployed escrow** holds the funds and settles when a party or oracle calls it. It works, but it
  is a public contract, a deployment, and a custody surface.
- **A canonical transaction** can be submitted by the signer at the right time. The signer must be
  online; a deadman switch, an inheritance, or a key-loss rescue fails exactly when nobody is online.

The missing state is **parked**: the signed bytes are held, the condition is watched, and the
transaction is promoted only when the condition is true.

## 2. The PARK rule

PARK is a node policy draft, not a consensus change. The reference node enforces it; the rule is the
contribution.

### 2.1 The implemented v1 rules

**PARK-010 — Declared trigger.** The `self_verify` frame data contains
`(latch, eventId, expectedTag)`. The signature covers the frame data. A parked transaction has no
implicit or out-of-band trigger.

**PARK-020 — Staked entity.** The sender is a staked entity. The trigger read is a foreign-state
read inside `self_verify`; the canonical mempool refuses it, and the alt-mempool admits it for a
staked sender.

**PARK-030 — Template binding.** The node admits only an allow-listed account template. It checks
the code hash, the account's latch and event, the signature hash, every signature entry, and the
declared trigger. It does not trust the submitter and does not use state overrides.

**PARK-040 — Expiry.** Every parked transaction carries an `expiry_verify` frame. The node drops it
after the bound and revalidates at promotion.

**PARK-050 — Caps.** Each node enforces a per-entity and per-trigger cap. The caps are live policy;
the node rejects entry `P+1`, not just a batch overflow. The v1 reference uses `P=4` and `E=8`.

**PARK-060 — Promotion and eviction.** Entries are indexed by
`(latch, eventId, expectedTag)`. When the latch changes, the node promotes matching entries and
evicts the rest without simulation. One promotion per sibling group.

**PARK-070 — Sibling exception.** Mutually exclusive values of one nonce key may be held together
in the park area. The live mempool sees only the promoted value.

**PARK-080 — Gossip (optional).** A node may gossip to peers; peers revalidate independently. Gossip
is optional for correctness and leaks the trigger and timing.

### 2.2 The v2 target

The root `park-rule.md` is a stronger target spec, `PARK-010…100`. It is **not implemented** in the
current code. The important differences:

| Area | v1 implemented | v2 target |
|---|---|---|
| Trigger interface | concrete `Latch`, `uint8` tag | `ILatchTriggered.trigger()` / `requiredSigners()`; `ILatch.tagOf()` / `deadlineOf()`, `bytes32` tags |
| Caps | first-come `P=4`, `E=8` | rank-by-stake; per-entity 256, per-(trigger, entity) 8, per-trigger 4,096 |
| Eviction | on the tag change | deferred until the winner is confirmed; reorg-safe |
| Siblings | YES / NO / REFUND | outcome siblings plus a fee ladder |
| Payouts | direct `SENDER` to EOAs + gas buffer | pull payouts / `claimable` balances; `max_cost` check |
| Expiry | `deadline + 15 min` | `deadline + SETTLEMENT_WINDOW` (target: 1 hour) |
| Reputation | none | `PARK-090` classification |
| Gossip | `PARK-080` | `PARK-100` |
| Sidecar | none | issue text appendix |

The v2 target also changes the account interface. Adopting it requires code changes; the current
repo must not claim it is implemented.

## 3. Proof 1 — the deadman rescue

The first proof is a deadman switch with no owner online at the trigger.

- The owner deploys a `Latch` with an interval and a `RescueAccount` with a pre-committed beneficiary.
- The owner pings the latch while alive. `ping` updates the deadline.
- The owner pre-signs a rescue frame transaction:
  `[expiry_verify(deadline), self_verify(trigger = EXPIRED), SENDER(beneficiary, rescueAmount)]`.
  The account keeps a gas buffer.
- The park node accepts it while the latch is `UNSET`; the account's `self_verify` would fail now,
  so the live mempool rejects it.
- The owner stops pinging. After the interval plus grace, anyone calls `expire`; the latch becomes
  `EXPIRED`, write-once.
- The park node sees the change, promotes the rescue, and the beneficiary is paid. The owner was never
  online at the trigger; no keeper re-signed or chose the beneficiary.

A single account could mirror the latch in its own storage and run canonically. The alt-mempool's
addition is the shared latch: one `expire` can cover many rescue accounts, and the park nodes promote
the matching ones. The nobody-online case is the clean proof that the alt-mempool adds a capability,
not just a cheaper path.

## 4. Proof 2 — the binary DLC

The second proof is a binary DLC between Alice and Bob.

- A `DLCAccount` holds both deposits and names the parties, a latch, and fixed payouts.
- All cheques use one shared EIP-8250 key `K` at sequence 0: `CET_YES`, `CET_NO`, `CET_REFUND`.
- Each cheque carries both signatures, a trigger, an `expiry_verify` frame, and the payout frames.
- The park node holds the cheques while the latch is `UNSET`; the live alt-mempool would accept only
  one, and the canonical mempool would need the latch mirrored in the account's own storage.
- The oracle attests `YES` or `NO`; the matching cheque is promoted. The other values of `K` are
  invalid once the promoted cheque lands; the node evicts them without simulation.
- If the deadline passes with no attestation, `expire` sets `EXPIRED`; the refund is promoted. If only
  one party funded, an abort refund is valid for the recorded deposit.

The DLC is the mutual-exclusion proof: one shared key, one latch, one winner. A single DLC can run
canonically; the alt-mempool's contribution is the shared latch, the promoted sibling, and the
zero-simulation eviction of the losing values.

The **cap demo** is not a third proof; it is the rule-enforcement test. `P+1` is rejected live by
both nodes.

## 5. The reference implementation

The repo contains:

- **Contracts** — `Latch`, `RescueAccount`, `DLCAccount`, written in Solidity on
  `HegotaSupport(Devnet.ERC8421_WORKSHOP)`. `self_verify` reads the latch, checks the signers and the
  tag, checks the payout room, and approves execution and payment. The accounts are staked, so the
  foreign latch read is admitted by the alt-mempool.
- **Frame codec** — `@forshtat/hegota-support` for the EIP-8141/8250/8272 encoding; a minimal
  frame-tx build/send layer, with two signature entries for the DLC.
- **Park node** — a TypeScript service with two nodes. Node A accepts and gossips; node B
  independently revalidates the template, signatures, stake, expiry, and caps. Both enforce the live
  per-trigger cap; the demo shows node B rejecting `P+1`.
- **Cheque builders** — `src/cheques.ts` builds and signs the rescue, DLC, and abort cheques;
  `src/parkClient.ts` talks to the nodes; `src/sign.ts` is a barrel.
- **Demos** — the deadman rescue, the binary DLC, the cap, and the measurement. The gas comes from
  the receipt's `frameReceipts[0].gasUsed` or `ethrex_simulateFrameTransaction`, never the admission
  report.
- **Tests** — `contracts/test/` includes `DLCAccountHarness` and `DLCAbort`; `test/` contains the
  admission and store tests.
- **Docs** — `docs/park-rule.md` (v1), `park-rule.md` (v2 target), `docs/demo-runbook.md`, `README.md`.

The optional dashboard (`web/`, served by the park node) is planned but not built.

## 6. Why the alt-mempool

The rule needs four things the canonical mempool does not provide together:

1. A staked account may read foreign state inside `self_verify`; the canonical mempool refuses the
   read.
2. Multiple signed values can be held off-chain and promoted later; the canonical mempool is
   pass-or-reject.
3. A parked transaction can be revalidated at promotion against the current head; the alt-mempool
   already revalidates on new blocks, but it has no park area for a transaction that is invalid at
   the head.
4. A node can enforce a live per-trigger cap and a zero-simulation eviction; a plain RPC relay cannot.

## 7. Who it serves

- **Users with liveness-sensitive actions** — deadman switches, inheritance, key-loss rescue, and
  actions that must happen when the owner is offline.
- **Two-party binary outcomes** — a shared latch and one winning cheque, without a public settle or a
  per-contract poke.
- **Node operators** — a rule for a third state, a template allow-list, and a cap that bounds parked
  state.
- **The ecosystem** — a concrete rule draft and a reference implementation that can be tested against
  the EIP-8141 / ERC-8421 alt-mempool.

The project is not a consumer wallet. The deadman is a reference proof, not a general inheritance
product; the DLC is a minimal 2-of-2 account, not a general DLC protocol.

## 8. Current status

Local:

- 43 Foundry tests pass: `Latch` 15, `RescueAccount` 9, `DLCAccount` 11, `DLCAbort` 8.
- 12 Vitest tests pass; the TypeScript typecheck is clean.
- The contracts, two-node park layer, deploy script, cheque builders, demos, and measurement are
  implemented.
- The v1 rule is implemented; the v2 target is not.

Live:

- The live deploy is pending. The public devnet was frozen when the deploy was attempted; the funding
  transaction is still in the pool. The local code and the deploy/demo scripts are ready.
- No live promotion, gas, or explorer receipt has been recorded yet.
- The dashboard is optional and not built.

## 9. Scope and limitations

- The latch and the oracle are trust points. The rule does not make them trustless.
- The park node is a reference relay, not a sidecar feature. The rule is the product; the node is the
  proof.
- The DLC is a minimal 2-of-2 account. It is not a general DLC protocol.
- The winner can still submit after the trigger. The rule makes the losers invalid once the winner
  lands; it does not guarantee the winner is first.
- A single DLC can be done canonically. The rule targets shared latches, nobody-online triggers, and
  sibling sets.
- Gossip leaks the trigger and the timing. The repo makes no privacy claim.
- The v2 target is not implemented. Rank-by-stake caps, reorg-deferred eviction, fee ladders, pull
  payouts, `max_cost` arithmetic, and `PARK-090` reputation are future work.
- The v1 uses direct `SENDER` payouts to EOAs and a fixed gas buffer; a recipient contract that
  rejects value could revert the payout after the nonce key is consumed. This is a known v1
  limitation, addressed by the v2 pull-payout recommendation.
- The implementation is devnet-only and unaudited.

## 10. Prior art

- Dryja, *Discreet Log Contracts* (2017), and the DLC specification.
- Pisa, *Accountable Watchtowers* (2019), for the watch-and-respond pattern.
- ERC-4337 staked entities and ERC-7562 reputation for foreign-state reads.
- Base validity and other validity-based conditional submission work.
- ERC-8421 / EIP-8141 for the frame transaction and the alt-mempool.

The gap this repo fills is a **rule draft and reference implementation for latch-triggered parked
transactions**, with independent two-node admission, a live per-trigger cap, and zero-simulation
eviction of losing siblings. No native Ethereum DLC surfaced in our search; the repo is not claiming
that DLCs do not exist elsewhere.

## 11. Demo

```sh
yarn install --ignore-optional
yarn build:contracts
yarn deploy
yarn park:a
yarn park:b
yarn demo:deadman
yarn demo:dlc
yarn demo:cap
yarn measure
```

`yarn deploy` needs a funded devnet key in `TRELLIS_DEPLOYER_KEY`. The exact commands, the devnet
health check, and the recovery steps are in `docs/demo-runbook.md`.

The demo prints the latch address, the parked entries, the promotion, the admission result, the
receipt, the explorer link, and the measured gas. The deadman rescue is rejected before `expire` and
accepted after; the DLC's losing values are evicted without simulation; node B rejects `P+1`.

If the devnet is frozen, rely on the local tests and say that the live run is pending. Do not claim
a live measurement you do not have.

## 12. Next work

1. **Live run** — deploy, both nodes, deadman, DLC, cap, measure; record the receipts and gas in
   `docs/live-run.md`.
2. **v2 correctness fixes** — reorg-deferred eviction, `max_cost` / expiry arithmetic, and pull
   payouts (or a documented v1 limitation).
3. **Node hardening** — local node smoke test, store persistence, promotion retry.
4. **More proofs** — one-sided abort and expired-refund demos.
5. **Measurement** — attest-to-inclusion latency.
6. **Delivery** — CI, architecture notes, optional dashboard.
