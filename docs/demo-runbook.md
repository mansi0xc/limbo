# Demo runbook

## 0. Devnet health

```sh
curl -s -X POST https://altmempoolgateway.forshtat.com/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'
```

Run it twice about 10 seconds apart. If the block number does not advance, the devnet is stalled.
Wait for the workshop host; do not keep submitting transactions against a frozen miner.

## 1. Build

```sh
yarn install --ignore-optional
yarn build:contracts
yarn typecheck
yarn test
yarn test:contracts
```

Expected: Foundry `43 passed`, Vitest `12 passed`.

## 2. Deploy

Use a funded devnet key. The deploy script creates the owner, Alice, Bob, oracle, and beneficiary
keys and funds them from the deployer.

```sh
export TRELLIS_DEPLOYER_KEY=0x...
yarn deploy
```

Expected output includes the rescue latch, rescue account, DLC latch, DLC account, stake balances,
and both expiry values. The state is written to `.trellis-state.json` (git-ignored).

If the deploy reports `transaction ... was not mined within 180s`, check step 0. The transaction is
still in the pool; the deploy can be re-run when the devnet advances. The keys in the state are
reused.

## 3. Park nodes

Terminal 1:

```sh
yarn park:a
```

Terminal 2:

```sh
yarn park:b
```

Health and status:

```sh
curl -s http://127.0.0.1:8787/health
curl -s http://127.0.0.1:8787/status
curl -s http://127.0.0.1:8788/status
```

Node A accepts and gossips; node B independently admits and enforces the caps.

## 4. Deadman rescue

```sh
yarn demo:deadman
```

The script:

1. submits the rescue to the live alt-mempool before the latch changes; it is rejected;
2. parks the same bytes on node A; node B revalidates;
3. waits for the owner's interval plus grace;
4. calls `expire` (anyone can);
5. waits for node A to promote the rescue.

Expected: the beneficiary balance increases by the rescue amount; the receipt has the promotion
hash; the parked entry is marked `promoted`.

## 5. Binary DLC

```sh
yarn demo:dlc
```

The script:

1. submits `YES` directly; it is rejected while the latch is unset;
2. parks `YES` and `NO`, which share one nonce key;
3. attests `NO` from the oracle;
4. waits for the promotion of `NO`; `YES` is evicted without simulation;
5. resubmits `YES`; the shared key is consumed, so it is rejected.

Expected: Bob's balance increases by the payout; the status shows the DLC entries as
`2:promoted` and `1:evicted`.

## 6. Cap

```sh
yarn demo:cap
```

The script submits `P+1 = 5` rescue cheques for one trigger. Expected: the first four are accepted;
the fifth is rejected by node A with `PARK-050`; the direct fifth to node B is also rejected because
node B already has the first four from gossip.

## 7. Measure

```sh
yarn measure
```

Run it after `demo:deadman` and `demo:dlc`. The script calls `ethrex_simulateFrameTransaction` on the
root URL, then reads what the demos recorded in `.trellis-state.json` and the promoted receipts. It
prints a Markdown table, one row per workload:

- the live mempool's verdict on the cheque before the trigger (recorded by the demo);
- the trigger transaction's block, the inclusion block, and the blocks between them;
- validation gas (frames 0 and 1) and total frame gas, from the receipt;
- for the DLC, the verdict on resubmitting the losing sibling after the winner landed.

Every number comes from a receipt or a recorded RPC response, never from the admission report. Paste
the table into the submission as-is.

## Troubleshooting

- **`PARK-030` / `signature 0 is not a template signer`** — the parked transaction was built for a
  different key set. Re-run the deploy and rebuild the cheques.
- **`PARK-020` / `sender is not staked`** — the account's `stake` transaction did not land. Re-run
  `yarn deploy`.
- **`PARK-040` / `expiry is before the latch deadline`** — the state's expiry is stale. Redeploy.
- **`PARK-050` / per-trigger cap reached** — the demo already parked `P` entries for that trigger.
  The park area survives restarts (`.park/`), so delete `.park/` or use a fresh deploy.
- **`PARK-050` / duplicate of entry ...** — those exact bytes are already parked or promoted on this
  node. Nothing to do.
- **`NotExpired` / `BadState` from the account** — the trigger is being submitted before the latch
  changed. This is the expected pre-trigger rejection.
- **`transaction ... was not mined within 180s`** — the devnet is stalled; check step 0. Do not send
  more transactions until the block number advances.

## Reset

Stop the nodes, delete `.trellis-state.json` and `.park/`, and re-run `yarn deploy`. The next deploy creates a new
rescue account, DLC account, and latch set. The old devnet contracts remain; they are not reused.
