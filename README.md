# Trellis

Trellis is a reference implementation of **latch-triggered parked frame transactions** on the
EIP-8141 / ERC-8421 alt-mempool.

Built for the EF Frame Transaction Alt Mempool track at ETHGlobal Mumbai 2026.

The rule is **PARK**. The headline workload is a **deadman rescue** that lands when nobody is
online. The second workload, a **binary DLC**, exists to exercise the sibling mechanism: one shared
nonce key settles the winner and the losers are dropped without simulation.

## Why not a keeper?

Today a transaction that only becomes valid after some on-chain write has nowhere to wait. Someone
runs a keeper: a bespoke off-chain service that stores the signed bytes (or re-signs), watches the
chain, and decides when to resubmit. Every app builds or rents its own.

PARK moves that holding into **mempool policy**:

| | Keeper | PARK |
|---|---|---|
| Where the bytes wait | One operator's service | Any node applying the rule; peers revalidate independently |
| Who can submit at the trigger | The keeper (it holds the bytes) | Any holder; the bytes are fully signed and need no re-signing |
| What the operator decides | Whether, when, and often to whom | Nothing: the signed trigger and payouts fix the outcome |
| Abuse bound | Per-service (API keys, fees) | Staked sender, live per-trigger and per-entity caps |
| Mutually exclusive variants | Keeper must simulate or track them | Held together; losers evicted from one latch read, no simulation |
| Integration | Per app | One account pattern: declare `(latch, eventId, tag)` in `self_verify` |

Honest caveat: in this reference implementation a park node is still a relay you hand the bytes to.
The claim is not that a node is trustless; it is that holding latch-triggered transactions becomes a
standard, permissionless node behaviour instead of custom infrastructure. Gossip, persistence, and
node B's delayed fallback are how the reference deploy avoids depending on one process.

## The rule

PARK is a node policy, not a consensus change. The implemented rule is
[`docs/park-rule.md`](docs/park-rule.md). Where it goes next (interface-based admission, stake-ranked
caps, reorg-safe eviction) is [`docs/park-rule-v2-draft.md`](docs/park-rule-v2-draft.md), which is
not implemented.

- **PARK-010** — the signed `self_verify` data declares `(latch, eventId, expectedTag)`.
- **PARK-020** — the sender is staked; the trigger is a foreign-state read that the alt-mempool
  admits for a staked entity.
- **PARK-030** — the node binds the transaction to an allow-listed account template, recomputes the
  signature hash, and verifies every signature entry.
- **PARK-040** — every parked transaction carries an `expiry_verify` frame.
- **PARK-050** — live per-entity and per-trigger caps; entry `P+1` is rejected, not just a batch
  overflow.
- **PARK-060** — index by `(latch, eventId, tag)`; promote the matching entry; evict the losers
  without simulation.
- **PARK-070** — the park area may hold mutually exclusive siblings; the live mempool only sees the
  promoted one.
- **PARK-080** — optional gossip; peers revalidate independently; gossip leaks timing.

## The two workloads

### Deadman rescue

The owner pings a latch. A pre-signed rescue waits in the park node while the latch is `UNSET`. The
owner goes offline; after the interval plus grace anyone calls `expire`; the latch becomes `EXPIRED`;
the park node promotes the rescue and the beneficiary is paid. The owner is not online at the
trigger, and no keeper re-signs or chooses the beneficiary.

### Binary DLC (sibling mechanism)

A single DLC does not need parking: both parties are online and the winner can submit their own
cheque. The DLC is here because it is the smallest real case of mutually exclusive transactions on
one key, which is what PARK-060/070 are about.

Alice and Bob fund a 2-of-2 account up to fixed stakes. `CET_YES`, `CET_NO`, and `CET_REFUND` all use
one shared EIP-8250 key at sequence 0. The oracle attests; the matching cheque is promoted; the other
values of the key become invalid once the winner lands. If one side never meets its stake, the other
side can abort with a single signature: the account requires the abort to mark itself aborted (checked
by frame introspection), then each party claims its own deposit back.

## How it works

```
[ expiry_verify(deadline),
  self_verify(trigger),
  sender(self.mark())     # rescue and abort only
  sender(payout 1),
  sender(payout 2) ]
```

The `self_verify` frame targets the staked account. Its data is the signed trigger. The account
reads the shared latch, checks its signers and tag, checks the payout room, and approves execution
and payment. For the rescue and the abort it also reads the transaction's own frames and requires a
`markRescued` / `markAborted` self-call, so the signer cannot leave the state change out. The rescue must
also pay the beneficiary at least the rescue amount and send value nowhere else; the abort may send value
nowhere at all. The two park nodes independently admit and revalidate the same signed bytes. The
promoter sends the parked bytes unchanged to the alt-mempool gateway.

## Quick start

Prerequisites: Node 20.12+, Yarn 1.22, Foundry `forge`, and the devnet gateway on chain 1337.

```sh
yarn install --ignore-optional
yarn build:contracts
yarn typecheck
yarn test
yarn test:contracts
```

Deploy with a funded devnet key. The deploy script generates the other keys and funds the accounts
from the deployer:

```sh
export TRELLIS_DEPLOYER_KEY=0x...
yarn deploy
```

The deployed addresses, generated keys, deadlines, and code hashes go into `.trellis-state.json`,
which is git-ignored.

Run the two park nodes in separate terminals:

```sh
yarn park:a
yarn park:b
```

Then run the workloads:

```sh
yarn demo:deadman
yarn demo:dlc
yarn demo:cap
yarn measure
```

The exact commands and expected output are in [`docs/demo-runbook.md`](docs/demo-runbook.md).

To watch the park area live, run the web app (`cd web && npm install && npm run dev`) and open
`/explorer` while both nodes run. It reads each node's `GET /status` and shows the latch, every parked
cheque on both nodes, evictions, landed transactions, and node B's fallback countdown. Stop node A after
the latch settles to watch node B take over.

## Tests

- `yarn test:contracts` — 68 Foundry tests for the latch, rescue account, DLC account, stakes and
  deposit caps, refunds, the abort and claim path, the rescue payout and window, and the frame
  introspection loop (opcode helpers mocked, since Foundry has no frame opcodes; the opcodes themselves
  are only exercised on the devnet).
- `yarn test` — 23 Vitest tests for admission, signatures, duplicates, caps, the store and its
  persistence, sibling groups, retries, and the fallback promoter.
- `yarn typecheck` — strict TypeScript.

## Layout

```
contracts/src/Latch.sol            tri-state write-once latch
contracts/src/RescueAccount.sol    staked deadman rescue account
contracts/src/DLCAccount.sol       staked 2-of-2 binary DLC account
src/frameTx/                       frame-tx build, sign, wire, and send layer
src/park/                          admission, store, indexer, promoter, gossip, node
src/sign.ts                        rescue and DLC cheque builders
src/deploy.ts                      deploy, stake, and fund the accounts
src/demo/                          deadman, DLC, and cap scenarios
src/measure.ts                     Markdown table of verdicts, gas and trigger-to-inclusion blocks
docs/park-rule.md                  the implemented rule
docs/park-rule-v2-draft.md         the next version (not implemented)
docs/demo-runbook.md               commands and expected output
docs/notes/                        early idea and build-plan notes, kept for history
```

## Limits

- The latch and the oracle are trust points. The rule does not make them trustless. The oracle can only
  attest on fixed-deadline events; a heartbeat event can only end in `EXPIRED`.
- A parked cheque carries a fixed expiry. A deadman cheque is signed with an expiry one hour after the
  current heartbeat deadline, so an owner who keeps pinging past that hour must re-sign and re-park the
  rescue (or sign with a longer expiry). A cheque that expires while the owner is still pinging does
  nothing.
- The rescue account's funds are locked only while a rescue is pending: latch `EXPIRED`, rescue not
  landed, and the rescue window (grace + cheque expiry + margin after the deadline) still open. In every
  other state the owner can withdraw, including the leftover after the rescue, and a rescue that never
  lands releases the funds when the window closes.
- Each DLC side can deposit up to its stake and no more.
- Stake recovery: the accounts hold their registry stake under their own address; getting it back needs
  a signed cheque whose SENDER frame calls the registry.
- Park nodes persist their park area to `.park/` and reload it on start. Node A promotes; node B
  promotes after 30 seconds if the entry is still parked.
- The park node is a reference relay, not a sidecar feature. The rule is the product.
- Admission uses allow-listed templates (exact account address and code hash from one deploy), not
  an interface any account can implement. Interface-based admission is v2 work.
- Caps are first-come, not ranked by stake, and losing siblings are evicted without waiting for
  reorg safety. Both are v2 work.
- The DLC is a minimal 2-of-2 account, not a general DLC protocol.
- The winner can still submit after the trigger. The loser is invalid only once the winner lands.
- A single DLC or a latch mirrored in the account's own storage can run canonically. The PARK rule
  targets shared latches, nobody-online triggers, and sibling sets.
- Gossip leaks the trigger and timing. The repo makes no privacy claim.
- The implementation is devnet-only and unaudited.

## Devnet

The public devnet is chain 1337, gateway `https://altmempoolgateway.forshtat.com/rpc`, explorer
`https://explorer.altmempool.wtf/`. The runbook includes a health check. If `eth_blockNumber` does
not advance for 30 seconds, the devnet is stalled; wait for the workshop host before submitting
more transactions.
