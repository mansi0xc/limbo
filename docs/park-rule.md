# PARK — latch-triggered parked frame transactions

**Status:** draft node policy. This is not a consensus change and not a sidecar feature.

PARK lets a signed frame transaction wait until a write-once latch changes, then be promoted by a
park node. The parked bytes are the bytes that land. The rule is enforced by the node; the account
enforces the final on-chain check in `self_verify`.

## Terms

- **Latch** — a write-once contract with a `state(bytes32)` of `UNSET`, `YES`, `NO`, or `EXPIRED`.
- **Trigger** — `(latch, eventId, expectedTag)`.
- **Template** — an allow-listed account with a code hash, a latch, an event, allowed tags, and
  expected signers.
- **Park node** — a node that admits, holds, revalidates, and promotes parked transactions.
- **Sibling** — another signed value of the same `(sender, nonceKey, nonceSeq)`.

## Rules

### PARK-010 — Declared trigger

The `self_verify` frame's data MUST be `abi.encode(address latch, bytes32 eventId, uint8
expectedTag)`. The signature MUST cover the frame data. A parked transaction MUST NOT use an implicit
or out-of-band trigger.

A node MUST reject a transaction whose declared trigger differs from the signed trigger.

### PARK-020 — Staked entity

The transaction sender MUST be a staked entity. The trigger read is a foreign-state read inside
`self_verify`. The canonical mempool does not admit that read; the standard alt-mempool does for a
staked sender.

A node MUST check the sender's stake before it parks and MUST reject a sender whose stake is below
the node's minimum or whose withdrawal time is set.

### PARK-030 — Template binding

A node MUST admit only an allow-listed template. It MUST:

- check the sender's code hash against the template;
- read the account's latch and event and compare them with the trigger;
- recompute the signature hash from the signed bytes;
- verify every signature entry recovers to a template signer;
- reject a transaction with a different signature count;
- avoid state overrides.

The node MUST NOT trust the submitter's declared metadata.

### PARK-040 — Expiry

Every parked transaction MUST carry an `expiry_verify` frame with an upper bound. The bound MUST be
after the latch deadline. A node MUST drop a transaction after the bound and MUST revalidate at
promotion.

### PARK-050 — Caps

Each node MUST enforce a per-entity parked cap and a per-trigger parked cap. The caps are live node
policy, not consensus. A node MUST reject entry `P+1` for one trigger, not only at the end of a
bundle. The reference caps are `P=4` and `E=8`.

A resubmission of bytes the node already holds (parked or promoted, matched by transaction hash) MUST
be rejected and MUST NOT count again. Otherwise anyone who saw the bytes, for example through gossip,
could replay one cheque until the per-entity cap blocks the other outcomes.

### PARK-060 — Promotion and eviction

A node MUST index entries by `(latch, eventId, expectedTag)`. When the latch changes, it MUST:

- promote entries whose tag matches the new state;
- evict entries whose tag does not match, without simulating them;
- promote at most one entry per sibling group.

A loser MUST NOT be simulated. The winner consumes the shared nonce key, so the other values of that
key become invalid once the winner lands.

A sibling group is `(sender, nonce key, nonce seq)`. Matching entries on different keys are independent
transactions and are promoted independently.

A promotion that fails transiently (gateway error, receipt timeout) is retried with exponential backoff.
A promotion that can never succeed (mined with a failed frame, or its nonce already consumed) marks the
entry failed and evicts its siblings; the node does not resend it.

The reference deployment runs two nodes. Node A promotes as soon as the latch settles. Node B promotes a
matching entry that is still parked 30 seconds after it saw the latch settle, so the trigger still lands
if node A is down. The promoter checks for an existing receipt first, and the shared nonce makes a
double send harmless. Each node persists its park area to `.park/<node>.json` and reloads it on start.

### PARK-070 — Sibling exception

Mutually exclusive values of one slot MAY be held together in the park area even though the live
mempool only accepts one. The exception applies only to the parked set. The live mempool sees the
promoted value, never the siblings.

The rule does not make the loser invalid before the winner lands. A party that can submit after the
trigger does not need parking.

### PARK-080 — Gossip (optional)

A node MAY gossip a parked transaction to peers. A peer MUST revalidate independently. Gossip is
optional for correctness. It costs privacy because the trigger and timing leak. The rule does not
require a global shared park.

## Reference implementation

- `src/park/admission.ts` implements PARK-010…050.
- `src/park/store.ts` indexes the parked set, implements the caps, sibling groups and duplicate
  lookup, and persists the park area.
- `src/park/indexer.ts` implements PARK-060, including zero-simulation eviction.
- `src/park/promoter.ts` submits the parked bytes unchanged and records the receipt gas.
- `src/park/node.ts` runs the two-node server; `src/park/gossip.ts` is the peer path.
- `src/park/templates.ts` builds the rescue and DLC templates from the deployed state.

## Next: v2

[`park-rule-v2-draft.md`](park-rule-v2-draft.md) is the unimplemented next step. In short:

- **Interface-based admission** instead of per-deploy templates, so any account that exposes its
  trigger can be parked without node configuration. Today each node is configured with the exact
  account addresses and code hashes from one deploy; that is a reference-implementation shortcut,
  not part of the rule.
- **Caps ranked by stake** instead of first-come, so filling a trigger costs stake linear in the
  slots taken.
- **Reorg-safe eviction**: keep losing siblings until the winner is confirmed.

## Canonical baseline

A single account can mirror the latch in its own storage and run canonically. A single DLC can run
canonically. The alt-mempool adds the shared latch, the promoted sibling, and the zero-simulation
eviction. The repo does not claim that a single DLC needs parking.

## Limits

- The latch and the oracle are trust points.
- The park node is a relay; the rule is the product.
- The winner can still submit after the trigger.
- Gossip leaks the trigger and timing.
- The implementation is devnet-only and unaudited.
