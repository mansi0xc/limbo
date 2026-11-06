# Uniswap feedback — QuoteBook / PRED

This file is the Uniswap Build-with-Uniswap feedback deliverable. It records what we learned while
building the PRED workload on the EIP-8141 frame-transaction devnet. The QuoteBook is **EF
infrastructure**, not a Uniswap v4 hook. The Uniswap entry is a proposed v4 workload, not a shipped
one.

## What we built

`contracts/src/QuoteBook.sol` is a same-block quote book for PRED:

- the maker posts one quote per block (`postQuote`);
- a trade is valid only while that quote is the latest and was posted in this block;
- the trade's pay frame (`validateTake`) checks the frame shape, the quote, size, price and fee caps,
  then approves `Scope.PAYMENT`;
- the SENDER frame (`take`) re-checks the gate and settles the token leg;
- an optional `assertFilled` VERIFY frame proves the swap succeeded, so a failed body makes the
  transaction invalid rather than a reverted, paid transaction.

`src/frameTx/pred.ts` builds the quote and trade transactions; `sendPrivilegedFrameTx` submits the
pair through the devnet's privileged endpoint because an invalid-at-head trade cannot enter the
public mempool.

## Findings for Uniswap

1. **Hooks cannot see their transaction's context today.** A v4 hook sees `msg.sender` as the
   `PoolManager` and the router as the caller. It cannot inspect the rest of the transaction. EIP-8141
   `TXPARAM`, `FRAMEPARAM` and `FRAMEDATALOAD` give a frame target the transaction's frame list, but
   only while the transaction is a frame transaction.
2. **The introspection opcodes halt in ordinary transactions.** A hook cannot safely ask "am I in a
   frame transaction?" because the opcode exception halts the call. A low-gas self-call that catches
   the failure is the proposed workaround; it is not proven in a v4 hook.
3. **`TXPARAM` exposes no payer field.** A hook that pays gas must prove the pay frame's selector and
   status and re-check the swap frame and its parameters. Checking "some VERIFY frame to me
   succeeded" is bypassable by any view call.
4. **`beforeSwapReturnDelta` is custom accounting, not a general custom curve.** It can replace the
   swap amount, but it does not write `slot0`; a full-delta hook freezes the pool's price view.
5. **ERC-6909 inventory needs an unlock callback.** `PoolManager.mint` and `burn` are
   `onlyWhenUnlocked`; a hook that holds maker inventory has to implement `IUnlockCallback` and a
   small position account.
6. **The devnet PoolManager is not the canonical build.** `0x6bF9Aa9c04fd001385742d61f6818C3236429848`
   is 24,009 bytes on chain 1337; pin its v4-core version before writing a hook against it.
7. **A frame-only gate is not routable.** Universal Router, aggregators and UniswapX fillers cannot
   produce a custom four-frame transaction. A state-based revert gate is the routable fallback; the
   frame path is the gasless lane that never lands a failed trade.
8. **Prior art is dense.** Angstrom's per-block lock is a live v4 hook and is routable through
   `hookData`; P.A.T won the v4 Volatile-Pairs Hooks prize with a TEE prop-AMM hook; ERC-8324/PUR
   standardizes update-first registries; McAMM, Bombora, Base validity and EIP-7793/EIP-8209 all
   cover parts of the ordering story.

## What a Uniswap entry would need

1. A real v4 hook (or a Uniswap tool) in the repo, with a README pointing to the exact contracts and
   lines. The QuoteBook alone is not a Uniswap integration.
2. A state-based quote gate for ordinary transactions, and a frame-only lane as the experimental
   gasless path.
3. A live demo through the PoolManager on 1337, or a labelled local/fork demo if the devnet is
   unavailable.
4. The hooks' known limits in the README: no transaction-context introspection outside frames, no
   payer field, frozen `slot0` under a full-delta hook, and no router path for the frame-only lane.

## Status

- `forge test`: 57 passing, including 9 QuoteBook tests.
- `vitest`: 16 passing, including the PRED frame builders.
- No live QuoteBook deployment; the devnet deployer is unfunded.
- No v4 hook; this file is feedback for the proposed workload, not a shipped Uniswap integration.
