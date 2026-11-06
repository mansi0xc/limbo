# Build plan

## Goal

A working EF Frame Transaction Alt Mempool submission with:

1. **PARK-010…080** — a rule draft for latch-triggered parked transactions.
2. **A reference park node** — two nodes, template admission, tag-indexed promotion, zero-simulation
   eviction, and a live per-trigger cap.
3. **A nobody-online workload** — a deadman rescue that lands after the owner stops pinging.
4. **A binary DLC** — one shared EIP-8250 key, YES/NO/EXPIRED latch, sibling eviction, and an abort
   refund.
5. **A live demo** on devnet 1337 with explorer links, admission records, and measured validation
   gas.

## Non-goals

- Numeric or ZK DLCs and per-bucket cheques.
- Q-Day or post-quantum vaults as the main story.
- A second track.
- A settlement paymaster.
- Any claim of production readiness, audit status, or privacy.

## Architecture

### Transaction shape

```
[ expiry_verify(deadline),
  self_verify(trigger),
  ...calls,
  ...payouts ]
```

- `expiry_verify` binds the upper bound.
- `self_verify` targets the staked account. Its data is
  `abi.encode(latch, eventId, expectedTag)`, signed by the parties.
- The account reads the shared latch, checks the signers and tag, checks the payout room, and calls
  `approve(EXECUTION_AND_PAYMENT)`.
- The `sender` frames pay the beneficiary or the DLC parties and can mark an abort.

### One shared nonce key

All mutually exclusive cheques use one EIP-8250 key `K` at sequence 0. The first promoted cheque
consumes `K`; the other values become invalid. There is no `settled` flag: `self_verify` is a
STATICCALL and cannot write. The key is the exclusion mechanism.

### Two-node park layer

- Node A accepts and gossips.
- Node B independently runs the same admission checks and the same caps.
- Both enforce the live per-trigger cap; node B rejects entry `P+1`.
- When the latch changes, the matching entry is promoted; the rest are evicted without simulation.
- The promoted bytes go to the alt-mempool gateway; the receipt and gas are recorded.

### Workloads

- **Deadman rescue** — `Latch` with a heartbeat; `RescueAccount` with a beneficiary; a pre-signed
  `EXPIRED` rescue; the owner goes offline; `expire` trips the latch; the rescue promotes.
- **Binary DLC** — `DLCAccount` with two parties and a shared key; `CET_YES`, `CET_NO`,
  `CET_REFUND`; the oracle attests; the matching cheque promotes; the siblings are invalid; the
  refund after `expire`; the abort refund for one-sided funding.

## Implemented files

```
contracts/src/Latch.sol
contracts/src/RescueAccount.sol
contracts/src/DLCAccount.sol
contracts/src/interfaces/ILatch.sol
contracts/src/interfaces/IStakingRegistry.sol
contracts/test/Latch.t.sol
contracts/test/RescueAccount.t.sol
contracts/test/DLCAccount.t.sol
contracts/test/DLCAccountHarness.sol
contracts/test/DLCAbort.t.sol

src/config.ts
src/state.ts
src/rpc.ts
src/chain.ts
src/contracts.ts
src/frameTx/profile.ts
src/frameTx/types.ts
src/frameTx/codec.ts
src/frameTx/wire.ts
src/frameTx/build.ts
src/frameTx/send.ts
src/frameTx/predeploys.ts
src/park/types.ts
src/park/store.ts
src/park/admission.ts
src/park/templates.ts
src/park/reader.ts
src/park/indexer.ts
src/park/promoter.ts
src/park/gossip.ts
src/park/node.ts
src/sign.ts
src/cheques.ts
src/parkClient.ts
src/deploy.ts
src/demo/deadman.ts
src/demo/dlc.ts
src/demo/cap.ts
src/measure.ts

test/admission.test.ts
test/store.test.ts

docs/park-rule.md
docs/demo-runbook.md
README.md
```

## Milestones and commit checkpoints

Each checkpoint is a reviewable commit. The maintainer commits; the automation does not.

### M0 — project docs

`docs: add Trellis idea and build plan` — `idea.md`, `plan.md`.

### M1 — scaffold

`chore: scaffold trellis package, foundry, and devnet config` — `package.json`, `yarn.lock`,
`tsconfig.json`, `foundry.toml`, `.gitignore`, `scripts/export-artifacts.mjs`, `src/config.ts`,
`src/state.ts`, `src/rpc.ts`, `src/chain.ts`, `src/contracts.ts`, `src/frameTx/`.

### M2 — contracts

`feat(contracts): add tri-state latch, rescue, and DLC accounts` — `contracts/src/`.

### M3 — contract tests

`test(contracts): cover latch, rescue, DLC, and payout room` — `contracts/test/`.

### M4 — park admission

`feat(park): add reference park node with template admission` — `src/park/types.ts`,
`src/park/store.ts`, `src/park/admission.ts`, `src/park/templates.ts`, `src/park/reader.ts`,
`test/admission.test.ts`, `test/store.test.ts`.

### M5 — two nodes and cap

`feat(park): add two-node gossip and live per-trigger cap` — `src/park/indexer.ts`,
`src/park/promoter.ts`, `src/park/gossip.ts`, `src/park/node.ts`, `src/demo/cap.ts`.

### M6 — demos

`feat(demo): add deadman, DLC, and cap scenarios` — `src/cheques.ts`, `src/parkClient.ts`,
`src/sign.ts`, `src/deploy.ts`, `src/demo/deadman.ts`, `src/demo/dlc.ts`, `src/demo/cap.ts`,
`src/measure.ts`.

### M7 — docs

`docs: add PARK rule draft, README, and demo runbook` — `README.md`, `docs/park-rule.md`,
`docs/demo-runbook.md`, `idea.md`, `plan.md`.

### M8 — final

`chore: final submission notes` — the final verification notes and any remaining edits.

### M9 — optional dashboard

The dashboard is a demo surface, not the protocol contribution. It is served by the park node as
static files; no new frontend framework.

- **C40** `feat(web): add the static dashboard shell` — `web/index.html`, `web/style.css`,
  `web/app.js`, and the park node static serve + `/state` endpoint; fixture mode for the frozen
  devnet.
- **C41** `feat(web): show the two-node cap and sibling eviction` — the A/B panels, `P=4`, `P+1`,
  the DLC YES/NO/REFUND siblings, the promotion receipt, and the gas.
- **C42** `docs: add the dashboard runbook` — `docs/dashboard.md`.

## Verification

Local:

- `yarn build:contracts` — compile and export artifacts.
- `yarn typecheck` — strict TypeScript.
- `yarn test:contracts` — 43 Foundry tests.
- `yarn test` — 12 Vitest tests.
- `yarn install --ignore-optional` — dependencies.

Live, when the devnet is advancing:

- `yarn deploy` — deploy, stake, and fund the accounts.
- `yarn park:a` and `yarn park:b` — the two nodes.
- `yarn demo:deadman` — the rescue is rejected before `expire`, parked, promoted after.
- `yarn demo:dlc` — `NO` promotes; `YES` is evicted; the shared key is consumed.
- `yarn demo:cap` — node B rejects `P+1` for one trigger.
- `yarn measure` — gas from the receipt or `ethrex_simulateFrameTransaction`, not the admission
  report.
- `yarn park:a` — serves `/`; the dashboard shows the latch, the A/B entries, the cap, and the
  promotion receipts. It can run from a fixture while the devnet is frozen.

## Current status

The local build is green: the contracts compile, 43 contract tests pass, 12 park tests pass, and the
TypeScript typecheck is clean. The live deploy was attempted against the public devnet while its
block height was frozen at block 408,262; the funding transaction is still in the pool. The deploy
can be re-run when the devnet advances. The runbook includes the health check and the recovery
steps.

## Risks and mitigations

- **The park node is a relay.** Mitigation: two nodes, template binding, a live cap, and the rule
  draft. Label the node as the reference, not a sidecar feature.
- **The DLC winner can submit later.** Mitigation: lead with the deadman; keep the DLC as the second
  workload; do not claim parking adds value for a single DLC.
- **One-sided funding locks funds.** Mitigation: the abort tag and `markAborted`, one signature, and
  a recorded deposit.
- **Payout room and max cost.** Mitigation: `gasBuffer`; the account checks its balance before
  approving.
- **Fee liveness.** Mitigation: sign a high fee cap; the unused part is refunded; a fee ladder is a
  follow-up.
- **Canonical baseline.** A single DLC or a mirrored latch can run canonically. The PARK rule is for
  shared latches, nobody-online triggers, and sibling sets.
- **Devnet stalls.** Mitigation: the health check, the 180s wait, and the runbook. Re-run the deploy
  when the block advances.
- **Stake and minStake.** The accounts stake themselves with 0.012 ETH and an 86400 delay.
- **Validation gas.** The account validation is small; measure it; do not claim a budget break.
- **Frontend scope.** The dashboard is a demo surface, not the rule. Build it after the live run;
  it must not delay the protocol proof.

## Cut order

Cut in this order:

1. Settlement paymaster.
2. Gossip encryption and multi-region peers.
3. Numeric outcome spaces.
4. Extra demo polish.
5. Dashboard polish.

Never cut:

- the two-node admission and the live per-trigger cap;
- the loser invalidity and the sibling eviction;
- the abort refund;
- the measured gas;
- the deadman demo.

## Definition of done

- The PARK rule is written as PARK-010…080.
- The contracts compile and the Foundry tests pass.
- The park-node tests pass, including the cap and sibling cases.
- The deadman rescue is rejected before `expire` and lands after it.
- The DLC winner lands, the losing values are invalid, and the refund works.
- Node B rejects `P+1` for one trigger.
- The gas comes from the receipt or the simulation.
- The README, runbook, and rule draft are complete.
- The optional dashboard is available if there is time; it is not required for the live run.
