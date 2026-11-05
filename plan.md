# Build plan

## Goal

A working EF Frame Transaction Alt Mempool submission with:

1. **PARK-010…080** — a rule draft for latch-triggered parked transactions.
2. **A reference park node** — two nodes, template admission, tag-indexed promotion, zero-simulation
   eviction of losers, and a live per-trigger cap.
3. **A nobody-online workload** — a deadman rescue that lands after the owner stops pinging.
4. **A binary DLC** — one shared EIP-8250 key, YES/NO/EXPIRED latch, sibling eviction, losing values
   invalid once the winner lands.
5. **A live demo** on devnet 1337 with explorer links, admission records, and measured validation gas.

## Non-goals

- Numeric or ZK DLCs, many-bucket outcome spaces, and per-bucket keyed cheques.
- Q-Day or post-quantum vaults as the main story.
- A second track or a second product line.
- A staked settlement paymaster (optional stretch, not part of the main build).
- Any claim of production readiness, audit status, or privacy.

## Architecture

### Transaction shape

```
[ expiry_verify(deadline),
  self_verify(trigger),
  sender(payout 1),
  sender(payout 2) ]
```

- `expiry_verify` binds the upper bound.
- `self_verify` targets the account. Its data is
  `abi.encode(latch, eventId, expectedTag)`, signed by the parties.
- The account reads the latch state, checks the signers and the tag, checks the payout room, and calls
  `approve(EXECUTION_AND_PAYMENT)`.
- The `sender` frames pay the beneficiary or the DLC parties.

The account is staked. The alt-mempool admits its foreign latch read; the canonical mempool does not.

### One shared nonce key

All mutually exclusive cheques use one EIP-8250 key `K` at sequence 0. The first promoted cheque
consumes `K`; the other values are invalid. There is no `settled` flag: `self_verify` is a STATICCALL
and cannot write. The key is the exclusion mechanism.

### Two-node park layer

- Node A accepts a signed cheque and gossips it to node B.
- Node B independently runs the same admission checks and the same caps.
- The per-trigger cap is live: node B rejects entry P+1, not just a batch overflow.
- When the latch changes, the matching entry is promoted; the rest are evicted without simulation.
- The promoted transaction goes to the alt-mempool gateway; the receipt and the gas are recorded.

### Workloads

- **Deadman rescue** — `Latch` with an owner heartbeat; `RescueAccount` with a beneficiary; a
  pre-signed `EXPIRED` rescue; the owner goes offline; `expire` trips the latch; the rescue promotes.
- **Binary DLC** — `DLCAccount` with two parties and a shared key; `CET_YES`, `CET_NO`,
  `CET_REFUND`; the oracle attests; the matching cheque promotes; the siblings are invalid; the
  refund after `expire`; the abort refund for one-sided funding.

## Repo layout

```
trellis/
  idea.md
  plan.md
  README.md
  package.json
  tsconfig.json
  foundry.toml
  .gitignore
  contracts/
    src/
      Latch.sol
      RescueAccount.sol
      DLCAccount.sol
      interfaces/ILatch.sol
    test/
      Latch.t.sol
      RescueAccount.t.sol
      DLCAccount.t.sol
  src/
    config.ts
    state.ts
    frameTx/
      build.ts
      send.ts
      codec.ts
      profile.ts
      types.ts
      predeploys.ts
    contracts.ts
    deploy.ts
    sign.ts
    park/
      types.ts
      admission.ts
      store.ts
      indexer.ts
      promoter.ts
      gossip.ts
      node.ts
    demo/
      deadman.ts
      dlc.ts
      cap.ts
    measure.ts
  test/
    admission.test.ts
    store.test.ts
  docs/
    park-rule.md
    demo-runbook.md
  scripts/
    demo-deadman.sh
    demo-dlc.sh
    demo-cap.sh
```

## Milestones

### M0 — project docs

- `idea.md`: the product, the PARK rule, the two workloads, the limits, the prior art.
- `plan.md`: this plan.

**Commit checkpoint:** `docs: add Trellis idea and build plan`

### M1 — scaffold

- `package.json`: `build:contracts`, `deploy`, `sign`, `park:a`, `park:b`, `demo:deadman`,
  `demo:dlc`, `demo:cap`, `measure`, `test`, `typecheck`.
- `tsconfig.json`, `foundry.toml`, `.gitignore`.
- `src/config.ts`: chain 1337, gateway/root/explorer, staking registry,
  `EXPIRY_VERIFIER` `0x81413f0cF12e9b6a49B1D0439E081c577D57FfFf`, stake 0.012 ETH, unstake 86400,
  deploy gas 6M, maxFeePerGas 2 gwei, caps `P=4`/`E=8`, ports 8787/8788.
- `src/frameTx/*`: the minimal codec/build/send/profile/types/predeploys layer from the workshop.
- `src/state.ts`: a JSON state file for keys, addresses, and hashes (gitignored).

**Commit checkpoint:** `chore: scaffold trellis package, foundry, and devnet config`

### M2 — contracts

Use Solidity inheriting `HegotaSupport(Devnet.ERC8421_WORKSHOP)`. No raw Yul: `HegotaSupport`
exposes `sigparam`, `framedataload`, `txparam`, `frameparam`, and `approve`.

#### `Latch.sol`

- `enum State { UNSET, YES, NO, EXPIRED }`.
- `mapping(bytes32 => State) public state;`
- `mapping(bytes32 => uint64) public deadline;`
- `address public immutable owner;`
- `address public immutable oracle;`
- `uint64 public immutable interval;`
- `uint64 public constant GRACE = 120;`
- `constructor(address owner_, address oracle_, uint64 interval_)`.
- `ping(bytes32 eventId)` — only owner; only if `state == UNSET`; `deadline = block.timestamp + interval`.
- `attest(bytes32 eventId, bool yes)` — only oracle; `state == UNSET`; `block.timestamp <= deadline`;
  set `YES` or `NO`.
- `expire(bytes32 eventId)` — permissionless; `state == UNSET`; `block.timestamp > deadline + GRACE`;
  set `EXPIRED`.
- `stateOf(bytes32)`, `deadlineOf(bytes32)`.
- Write-once: every transition requires `UNSET`; no setter, no proxy, no admin.

#### `RescueAccount.sol`

- `address public immutable owner; address public immutable beneficiary; Latch public immutable latch;
  bytes32 public immutable eventId; uint256 public immutable rescueAmount;
  uint256 public immutable gasBuffer;`
- `fallback()`:
  - decode `(address latch_, bytes32 eventId_, uint8 expectedTag)` from `msg.data`;
  - `require(latch_ == address(latch) && eventId_ == eventId)`;
  - `require(uint8(latch.state(eventId)) == expectedTag)`; the rescue uses `EXPIRED`;
  - `require(address(uint160(sigparam(0, SigParam.RESOLVED_SIGNER))) == owner)`;
  - `require(address(this).balance >= rescueAmount + gasBuffer)`;
  - `approve(Scope.EXECUTION_AND_PAYMENT)`.
- `withdraw()` — owner-only ordinary transaction before the latch; sends the balance to the owner.
  Optional; the demo owner is offline.
- Funded through the creation value, not a plain transfer (the fallback would run).
- The rescue `SENDER` frame pays `beneficiary` the `rescueAmount`; the account keeps `gasBuffer`.

#### `DLCAccount.sol`

- `address public immutable alice; address public immutable bob; Latch public immutable latch;
  bytes32 public immutable eventId; uint256 public immutable payoutA; uint256 public immutable payoutB;
  uint256 public immutable gasBuffer;`
- `mapping(address => uint256) public deposits; bool public bothFunded;`
- `deposit()` payable — records `deposits[msg.sender]`; recomputes `bothFunded`.
- `stake(uint32 delay)` — only Alice; calls the staking registry with the account's stake value.
- `fallback()`:
  - decode `(address latch_, bytes32 eventId_, uint8 expectedTag)` from `msg.data`;
  - `require(latch_ == address(latch) && eventId_ == eventId)`;
  - `require(uint8(latch.state(eventId)) == expectedTag)`;
  - `require(address(uint160(sigparam(0, SigParam.RESOLVED_SIGNER))) == alice)`;
  - `require(address(uint160(sigparam(1, SigParam.RESOLVED_SIGNER))) == bob)`;
  - `require(address(this).balance >= payoutA + payoutB + gasBuffer)` for outcome cheques;
  - `approve(Scope.EXECUTION_AND_PAYMENT)`.
- `CET_YES`/`CET_NO` use `payoutA`/`payoutB`; `CET_REFUND` uses the recorded deposits and is valid if
  `state == EXPIRED || !bothFunded` (abort refund).
- The housekeeping path (`msg.data.length == 0`) allows `stake`/`ping`/`deposit` with Alice's
  signature only; the cheques always carry trigger data and require both signatures.
- One shared key `K` for all cheques; `nonceKeys: [K]`, `nonceSeq: 0`. Housekeeping uses the legacy
  nonce.

#### Foundry tests

- `Latch.t.sol`: oracle-only, write-once, `attest` before deadline, `expire` after grace, `ping`.
- `RescueAccount.t.sol`: wrong signer, wrong tag, wrong latch, expired passes, pre-expiry fails.
- `DLCAccount.t.sol`: both signers, one signer fails, wrong tag, solvency, abort refund, deposit
  records.
- Use `vm.warp`; no devnet dependency.

**Commit checkpoint:** `feat(contracts): add tri-state latch, rescue, and DLC accounts`
**Commit checkpoint:** `test(contracts): cover latch, rescue, DLC, and payout room`

### M3 — two-node park layer

#### Admission

`validate(tx, trigger)` checks, without trusting the sender and without state overrides:

1. **Template binding** — `tx.sender` code hash is in the allow-list (`RescueAccount`, `DLCAccount`);
   the trigger's latch is the account's `latch`; the `eventId` matches.
2. **Trigger declaration** — decode `(latch, eventId, expectedTag)` from the signed `self_verify`
   frame data; it must equal the declared trigger.
3. **Signatures** — recompute the signature hash; recover `sig[0]`/`sig[1]`; check against the
   account's `owner` (rescue) or `alice`/`bob` (DLC).
4. **Latch unset** — `latch.state(eventId) == UNSET` at admission.
5. **Staked sender** — `getStake(tx.sender).amount >= minStake` and `withdrawTime == 0`.
6. **Expiry** — an `expiry_verify` frame is present and its deadline is in the future.
7. **Caps** — per-entity cap `E=8` and per-trigger cap `P=4`; reject P+1.
8. **Sibling policy** — cheques that share `(sender, key, seq)` form a sibling group; the park store
   may hold them together; the live mempool only ever gets the promoted one.

#### Store

- Map `id -> ParkedEntry { tx, trigger, signers, deadline, codeHash, status, receivedAt }`.
- Index `triggerKey(latch,eventId,expectedTag) -> Set<id>`.
- `countByTrigger(trigger)`, `countByEntity(sender)`.
- `siblings(sender,key,seq)`.
- Evict losers on a latch flip; promote matches; no simulation for losers.

#### Node

- HTTP server: `POST /park` (tx + trigger), `GET /status`, `GET /health`.
- Node A (8787) accepts from the demo; node B (8788) receives `/park` gossip.
- Node B runs `validate` independently and enforces the per-trigger cap; returns `accepted` or
  `rejected` with the rule id.
- Indexer polls `latch.state(eventId)` every 1s; on change, promotes entries whose `expectedTag`
  matches in fee order; evicts the rest with zero simulation; promotes once per sibling group.
- Promoter calls the gateway, waits for the receipt, and records the explorer link and the gas from
  `frameReceipts[0].gasUsed`.

**Commit checkpoint:** `feat(park): add reference park node with template admission`
**Commit checkpoint:** `feat(park): add two-node gossip and live per-trigger cap`

### M4 — demo scripts

#### Deadman

1. Deploy `Latch` (owner, oracle, interval 120s), `RescueAccount` (owner, beneficiary, latch, eventId,
   rescueAmount, gasBuffer); fund and stake the account; `ping`.
2. Build the rescue with `[expiry_verify(deadline), self_verify(trigger = EXPIRED),
   SENDER(beneficiary, rescueAmount)]`; sign with the owner; start node A and node B; park.
3. The owner stops pinging; wait for the interval plus grace; call `expire`; both nodes see
   `EXPIRED`; promote; the beneficiary is paid.
4. Show the same bytes rejected before `expire`; print the explorer link, the receipt, and the gas.

#### DLC

1. Deploy `Latch` (oracle), `DLCAccount` (alice, bob, latch, eventId, payoutA, payoutB, gasBuffer);
   deposit 1 ETH each; stake.
2. Build `CET_YES`, `CET_NO`, and `CET_REFUND` with the shared key `K`; two signatures each; park all
   three.
3. The oracle attests `NO`; node A promotes `NO`; `YES` and `REFUND` are evicted; the sidecar admits
   `NO`; Bob is paid; `K` is consumed; a resubmitted `YES` or `REFUND` is rejected.
4. A second account with no attestation: the deadline passes; `expire`; `REFUND`; split.
5. Show the sibling eviction with zero simulation and the loser invalid.

#### Cap

1. Park `P=4` entries for one trigger; node B rejects `P+1` with `PARK-050`.
2. Show node A and node B both enforce the cap; the rejected entry is not in the store.
3. Show the per-entity cap separately.

**Commit checkpoint:** `feat(demo): add deadman, DLC, and cap scenarios`

### M5 — measurement and docs

- `src/measure.ts`: call `ethrex_simulateFrameTransaction` on the root URL and read the receipt's
  `frameReceipts[0].gasUsed`; record validation gas, inclusion block, and attest-to-inclusion
  latency. Never read gas from the admission report.
- `docs/park-rule.md`: PARK-010…080; template binding; caps; sibling exception; indexing; gossip;
  privacy cost; limits.
- `README.md`: the one-liner, the demo, the rule, the limits, the commands, and the devnet.
- `docs/demo-runbook.md`: exact commands and expected outputs.

**Commit checkpoint:** `docs: add PARK rule draft and demo runbook`
**Commit checkpoint:** `chore: final submission notes`

## Verification

- `forge test --root contracts` — all contract tests pass.
- `npm test` — admission, store, cap, and sibling tests pass.
- `npm run deploy` — latch and accounts deployed and staked; addresses in `.trellis-state.json`.
- `npm run demo:deadman` — rescue promotes only after `expire`; beneficiary paid; explorer link.
- `npm run demo:dlc` — `NO` promotes; `YES` and `REFUND` rejected; sibling eviction; explorer link.
- `npm run demo:cap` — `P+1` rejected by node B; the cap is visible.
- `npm run measure` — gas from the receipt or simulation; latency; no estimates.
- Confirm the same signed bytes are rejected before the trigger and accepted after.
- Confirm the losing cheque is invalid and the winner pays.
- Confirm the two-node template check and the per-trigger cap are live.

## Risks and mitigations

- **The park node is a relay.** Mitigation: two nodes, template binding, a live per-trigger cap, and
  the rule draft. Label the node as the reference, not a sidecar feature.
- **The DLC winner can submit later.** Mitigation: lead with the deadman trigger; keep the DLC as the
  second workload; do not claim parking adds value for a single DLC.
- **One-sided funding locks funds.** Mitigation: abort refund; valid when `EXPIRED || !bothFunded`.
- **Payout room and max cost.** Mitigation: `gasBuffer`; the account checks its balance before
  approving; the payout frames leave the buffer.
- **Fee liveness.** Mitigation: sign a high fee cap; the unused part is refunded; a fee ladder is a
  follow-up.
- **Canonical baseline.** A single DLC or a mirrored latch can run canonically. The PARK rule is for
  shared latches, nobody-online triggers, and sibling sets.
- **Devnet reset.** One script redeploys and re-signs; keep a backup run.
- **Stake and minStake.** The account stakes itself with 0.012 ETH and an 86400 delay.
- **Validation gas.** The account validation is small; measure it; do not claim a budget break.
- **Time.** Cut the paymaster, gossip encryption, and the numeric mode first.

## Cut order

Cut in this order:

1. Settlement paymaster.
2. Gossip encryption and multi-region peers.
3. Numeric outcome spaces.
4. Extra demo polish.

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
- The gas comes from the receipt or the simulation, not the admission report.
- The README, runbook, and rule draft are complete.
