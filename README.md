# Trellis

Trellis is a reference implementation of **latch-triggered parked frame transactions** on the
EIP-8141 / ERC-8421 alt-mempool.

Built for the EF Frame Transaction Alt Mempool track at ETHGlobal Mumbai 2026.

The rule is **PARK**. The first workload is a **deadman rescue** that lands when nobody is online.
The second is a **binary DLC** where one shared nonce key settles the winner and invalidates the
siblings.

## The rule

PARK is a node policy, not a consensus change. The full draft is in
[`docs/park-rule.md`](docs/park-rule.md).

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

### Binary DLC

Alice and Bob fund a 2-of-2 account. `CET_YES`, `CET_NO`, and `CET_REFUND` all use one shared
EIP-8250 key at sequence 0. The oracle attests; the matching cheque is promoted; the other values of
the key become invalid once the winner lands. If one side never funds, a single signature can abort
and refund the deposit.

## How it works

```
[ expiry_verify(deadline),
  self_verify(trigger),
  sender(payout 1),
  sender(payout 2) ]
```

The `self_verify` frame targets the staked account. Its data is the signed trigger. The account
reads the shared latch, checks its signers and tag, checks the payout room, and approves execution
and payment. The two park nodes independently admit and revalidate the same signed bytes. The
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

## Tests

- `yarn test:contracts` — 43 Foundry tests for the latch, rescue account, DLC account, refunds, and
  abort path.
- `yarn test` — 12 Vitest tests for admission, signatures, caps, the store, and the sibling set.
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
src/measure.ts                     receipt and simulation measurements
```

## Limits

- The latch and the oracle are trust points. The rule does not make them trustless.
- The park node is a reference relay, not a sidecar feature. The rule is the product.
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
