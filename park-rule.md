# PARK: a parked state for latch-triggered frame transactions

**Status:** Draft, node policy for discussion. Not a consensus change.
**Scope:** ERC-8421 alternative-mempool nodes handling EIP-8141 frame transactions.
**Reference implementation:** Trellis (two independent park nodes, devnet 1337).

## 0. Summary

An ERC-8421 node has two answers for a frame transaction: admit or reject. A transaction whose validation is correct only after a specific on-chain write has no state in between, so it is held off-chain by a keeper, re-signed, or resubmitted.

PARK adds a third state, **parked**, for transactions whose only failing validation check is a declared read of a **write-once latch**. The node holds the signed bytes, indexes them by the latch slot they depend on, and promotes them to the live mempool in the block after the latch is written. Mutually exclusive variants of one keyed nonce (a sibling set) may be parked together; the live mempool only ever sees the one that matches.

PARK does not touch the live mempool's rules. Every promoted transaction is revalidated against the current head under the ordinary ERC-8421 checks before it is submitted. The park area is a holding pen with its own caps; it is not a second mempool.

## 1. Definitions

- **Latch.** A contract exposing `tagOf(bytes32 eventId) view returns (bytes32 tag)` where, for each `eventId`, `tag` transitions exactly once from `UNSET` to a terminal value and never changes afterwards. Which terminal values exist is the latch's business (YES / NO / EXPIRED, TRIPPED, PAID).
- **Trigger.** The tuple `(latch, eventId, expectedTag)` a parked transaction depends on.
- **Latch-triggered account.** A contract account whose `self_verify` reads `latch.tagOf(eventId)` and approves only if it equals the tag committed in the frame data.
- **Sibling set.** Parked transactions from one sender that share an EIP-8250 nonce key and sequence, so at most one of them can ever be included.
- **Park area.** The node's set of parked transactions. Distinct from the live mempool.
- **Promotion.** Moving a parked transaction into the live mempool via the node's ordinary admission path.

## 2. Account interface

A node does not special-case contracts. An account opts into PARK by implementing:

```solidity
interface ILatchTriggered {
    /// Decode the trigger this transaction depends on from the self_verify frame data.
    /// MUST be pure or view, MUST NOT read the latch, MUST revert on malformed data.
    function trigger(bytes calldata frameData)
        external view
        returns (address latch, bytes32 eventId, bytes32 expectedTag);

    /// The addresses whose signatures the account requires over the canonical
    /// frame hash, in signature-entry order. Used by the node to verify the
    /// parked bytes without simulating the account.
    function requiredSigners() external view returns (address[] memory);
}

interface ILatch {
    function tagOf(bytes32 eventId) external view returns (bytes32 tag);
    /// Seconds-since-epoch after which `eventId` may be forced to its
    /// time-out terminal value by anyone. Zero if the event has no deadline.
    function deadlineOf(bytes32 eventId) external view returns (uint64);
}
```

The account's own `self_verify` MUST re-derive the trigger from the same frame data and check it against the latch on-chain. The node's use of `trigger()` is an optimisation for indexing; on-chain validity is what makes the rule sound. Because `self_verify` runs as `STATICCALL`, the account cannot record settlement; the keyed nonce is the only exclusion mechanism and the rule relies on it.

## 3. Rules

### PARK-010 Declared trigger

A parked transaction MUST have exactly one trigger, derived by calling `ILatchTriggered.trigger(frame.data)` on the sender with the `self_verify` frame's data. The frame data is covered by the sender's signature scheme, so the trigger cannot be altered by a submitter. A transaction with an out-of-band or implicit trigger is not parkable.

### PARK-020 Staked sender

The sender MUST be a staked ERC-8421 entity in good standing. The latch read inside `self_verify` is a foreign-storage read, which the canonical mempool refuses and the alternative mempool admits only for staked entities. The node checks stake at admission and again at promotion.

### PARK-030 Admission without trust

To admit a transaction to the park area the node MUST, in order:

1. Verify the envelope statically: prefix shape allowed by ERC-8421 PREFIX-010, no `ATOMIC_BATCH_FLAG` in the prefix, gas limits within policy.
2. Check the sender's code hash against the node's allow-list. The allow-list is policy, not a protocol requirement; a node MAY accept any code hash that implements `ILatchTriggered`.
3. Call `trigger(frame.data)` and `requiredSigners()` on the sender via `eth_call` at the current head.
4. Recompute the canonical frame hash from the signed bytes and verify every signature entry against `requiredSigners()`.
5. Read `latch.tagOf(eventId)`. If it already equals `expectedTag`, route the transaction to ordinary admission instead of parking. If it equals a different terminal value, reject: the transaction can never become valid.
6. Check expiry (PARK-040) and caps (PARK-050).

The node MUST NOT use state overrides and MUST NOT simulate the account's `self_verify` at admission. Simulation is spent only at promotion (PARK-060).

### PARK-040 Expiry

Every parked transaction MUST carry an EIP-8141 expiry verifier frame. Let `E` be its 8-byte deadline and `D = latch.deadlineOf(eventId)`.

- If `D != 0` and `E <= D`, the node MUST reject: the latch cannot reach a time-out tag before `D`, so the transaction expires before it can become valid.
- The node SHOULD require `E >= D + SETTLEMENT_WINDOW` (policy; the reference uses 1 hour) so a latch write in the last block before `D` still has room to land.
- The node drops a parked transaction once `block.timestamp > E`.

Because `TIMESTAMP` is banned in validation outside the canonical expiry verifier, an account cannot treat "deadline passed" as a tag on its own. A time-out tag requires a latch write, which someone must send. Latches SHOULD pay a bounty to the caller of their time-out function so that this actor is permissionless and unprivileged; the rule does not remove the need for it.

### PARK-050 Caps and ordering

A node enforces three bounds. All are live policy.

- **Per-entity cap** `C_entity`: the total parked transactions from one staked entity. Bounds memory. Default 256.
- **Per-(trigger, entity) cap** `C_te`: parked transactions from one entity on one trigger. Default 8 (enough for a sibling set and a fee ladder).
- **Per-trigger budget** `C_trigger`: parked transactions on one trigger across all entities. Default 4,096.

When admitting a transaction would exceed `C_trigger`, the node MUST NOT simply reject the newcomer. It ranks every transaction on that trigger by `(entity_stake, age)` and evicts the lowest-ranked. A newcomer below the cut is rejected with `ParkTriggerFull`; an incumbent below the cut is evicted with `ParkEvictedByRank`.

Rationale: code-hash allow-listing permits anyone to deploy a conforming account pointed at a popular latch. A first-come hard cap would let an attacker fill a trigger for the price of `C_trigger` minimum stakes and lock out everyone else. Rank-by-stake makes the cost of occupying a slot linear in the stake behind it. A per-block promotion cap has the same griefing shape; PARK-060 avoids one.

### PARK-060 Promotion

After each canonical block, the node determines which watched `(latch, eventId)` slots changed, using the block's access list where available and re-reading watched slots otherwise. For each changed slot:

1. Read the new tag natively.
2. For each parked transaction on that slot whose `expectedTag` equals the new tag: run full ERC-8421 revalidation against the current head and, if it passes, submit it through the node's ordinary admission path. This is the only point at which the node simulates a parked transaction.
3. Transactions on that slot whose `expectedTag` differs are **candidates for eviction** under PARK-080. They are not simulated.

Within a sibling set, the node submits at most one member at a time (PARK-070). There is no per-block promotion cap; the work is bounded because the node simulates only matching entries, and the number of matching entries on a trigger is bounded by `C_trigger`. A node that must throttle submissions to the live mempool orders them by `(entity_stake, age)`, never first-come.

Promotion is idempotent and permissionless in effect: a promoted transaction is valid regardless of which node submitted it, so two park nodes that both promote the same bytes do no harm.

### PARK-070 Sibling sets

The park area MAY hold several transactions from one sender on the same nonce key and sequence, even though the live mempool accepts one. The exception applies only to the park area.

Two sibling patterns are recognised:

- **Outcome siblings.** Different `expectedTag` values on one trigger (YES / NO / REFUND). Exactly one can match; the rest are evicted after the winner lands.
- **Fee ladder.** The same `expectedTag` and payload signed at several fee caps. At promotion the node submits the highest-fee member the current base fee can pay and holds the others. If the submitted member fails for fee reasons it is withdrawn and the next rung tried. This is the recommended mitigation for fee liveness: a parked transaction otherwise has no unilateral path if the base fee stays above its signed cap.

The node MUST submit at most one member of a sibling set to the live mempool at a time.

### PARK-080 Eviction

A parked transaction is evicted when any of the following holds:

- its expiry `E` has passed;
- its nonce key and sequence have been consumed on-chain by any included transaction (the winner of its sibling set, or an unrelated transaction on the same key);
- the latch for its trigger holds a different terminal tag **and** the matching sibling, if any, has been included with `CONFIRMATIONS` blocks on top (policy; the reference uses 1 on devnet, 2 or more elsewhere);
- it was ranked out under PARK-050;
- its sender's stake fell below the minimum or its reputation was banned.

Eviction never simulates the evicted transaction. A losing sibling is not "probably invalid": its validity is determined by the key and the tag, both read natively.

Eviction on tag mismatch is deliberately deferred until the winner is confirmed. If the block carrying the latch write is reorged out, the tag returns to `UNSET`, the promoted member returns to parked, and no sibling has been lost. After the reorg the park area MUST equal what it would have held had the reorged blocks never arrived.

### PARK-090 Reputation classification

ERC-8421 reputation counts failed revalidations. A node applying PARK MUST classify:

| Event | Effect |
|---|---|
| Admitted to park | none |
| Trigger still unmet on re-read | none |
| Promoted and included | ordinary positive |
| Promoted, revalidation fails for a non-trigger reason | ordinary negative |
| Evicted by expiry, rank, or key consumption | none |
| Demoted by reorg | none |

Without this classification a patient entity with many parked transactions would be throttled for waiting, which is the behaviour the rule exists to support.

### PARK-100 Gossip (optional)

A node MAY forward parked transactions to peers. Peers MUST re-run PARK-030 independently and MUST NOT trust the forwarding node's admission. Gossip is not required for correctness: because a promoted transaction is valid regardless of submitter, any node that holds the bytes can promote them. Gossip leaks the trigger and the timing; the rule makes no privacy claim.

## 4. Account-level recommendations

These are not node rules, but accounts that ignore them will strand funds.

- **Pull payouts.** A SENDER frame that transfers to an external address can revert (a recipient contract rejecting value, a short gas buffer). If it reverts after the keyed nonce is consumed, every sibling, including the refund, is dead and the funds are locked. Execution frames SHOULD credit an internal `claimable[party]` balance; parties withdraw on the legacy nonce.
- **Recovery path.** Accounts SHOULD expose a settlement-independent exit on the legacy nonce: a joint-signature `recover()` at any time, and a unilateral recovery by recorded deposits after `deadline + LONG_GRACE`.
- **Housekeeping on the legacy nonce.** Staking, deposits, withdrawals and recovery MUST NOT use the sibling set's key, or they invalidate the pre-signed set.
- **Payout room.** The account pays `max_cost` before execution. Validation SHOULD approve only if `balance >= max_cost + payouts`; with pull payouts this reduces to `balance >= max_cost`.
- **Expiry arithmetic.** Sign `E = deadline + SETTLEMENT_WINDOW`, not `E = deadline`. For heartbeat latches whose deadline moves on every ping, re-sign the rescue at each ping or sign a ladder of expiries on the same key.

## 5. Why the alternative mempool

The canonical mempool cannot host this rule for four independent reasons: the latch read is a foreign-storage read; validation is pass-or-reject with no held state; the mempool has no park area or sibling set; and a plain relay cannot enforce caps or evict siblings without simulating them. ERC-8421 revalidates on new blocks, but it still has no place to hold a transaction that is invalid at the head. A node applying PARK is still a conforming ERC-8421 node for everything it submits.

## 6. What PARK does not claim

- It does not make the latch or its oracle trustless.
- It does not guarantee the matching transaction is first in the trigger block; a party that is online can still submit it directly.
- It does not remove the actor who writes a time-out tag; it makes that actor permissionless and unprivileged.
- It does not replace an escrow with a public `settle()`; it changes where the payout definition lives (in signed bytes, not deployed code).
- It is not private: a promoted transaction reveals the parties, the trigger and the amounts.

## 7. Prior art

Base validity transactions (predicate-held transactions on an L2 sequencer, 60-second bound, predicate not on-chain) are the closest shipped mechanism; PARK differs in that the condition is enforced inside the transaction's own validation, the hold is multi-node and long-horizon, and sibling sets are first-class. Dryja's Discreet Log Contracts supply the pre-signed-outcome pattern; Pisa supplies the watch-and-respond pattern that PARK replaces with mempool state. ERC-4337 and ERC-7562 supply staked foreign reads and reputation.

---

## Appendix: issue text for `forshtat/mempool-workshop-sidecar`

**Title:** Proposal: a `parked` state for latch-triggered frame transactions

**Body:**

A frame transaction whose `self_verify` reads a write-once latch is rejected by the sidecar today (PREFIX-060) until the latch is written, so the signed bytes have to be held by a keeper and resubmitted. We've drafted a node policy, PARK-010…100, that holds such transactions in a separate park area, indexes them by the latch slot, promotes only entries whose declared tag matches after a latch write, and evicts losing siblings on one keyed nonce without simulating them. Admission is interface-based (`ILatchTriggered`) and trust-free (signatures verified against the signed bytes, no state overrides); caps are rank-by-stake rather than first-come to avoid trigger griefing; eviction is deferred until the winner is confirmed so reorgs are safe.

Reference implementation with two independent nodes, measured promotion and gas, and two workloads (a deadman rescue and a batch of binary DLCs settled by one attestation): [repo link]. Full text: `docs/park-rule.md`.

Questions we'd value your view on: (1) whether `useropsTTL` and `maxSubmitAttempts` should apply from promotion rather than from original receipt; (2) whether the reputation classification in PARK-090 is compatible with the sidecar's current counters; (3) whether a `parked` state belongs in the sidecar or stays a separate service.
