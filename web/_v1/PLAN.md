# Trellis frontend plan

Everything frontend lives in `web/`. It doesn't import from `src/` or `contracts/`, so it can't break the node or the tests.

## The visual language (used on every screen)

One idea carries the whole UI: **a transaction's shape tells you its state.**

| Look | Means |
|---|---|
| Dashed outline | Signed and held, not valid yet |
| Solid fill | Landed in a block |
| Struck through, faded | Evicted or rejected, with the rule that did it |
| Green (vine) | PARK, valid later |
| Orange (ember) | PRED, valid right after |
| A small index number (0, 1, 2) | Position inside a block, because order is the whole point of PRED |

- **Type:** Instrument Serif for headlines, Geist for text, Geist Mono for anything that is on-chain (hashes, frames, block numbers, rule ids).
- **Colour:** warm paper background, near-black ink, and only the two accents above. Dark mode uses the same tokens.
- **Motion:** only CSS transitions on `opacity` and `transform`, triggered by a class. Scenes pause off-screen and in background tabs. With reduced motion, or if JS fails, every scene shows its final state, so nothing is ever blank.

## Screens

### 1. Landing page (built)
For judges and anyone who opens the link cold. One scroll tells the story:
1. **Hero:** "For transactions that aren't valid yet", with a looping node console: three cheques parked, the latch flips, the winner lands, the siblings are struck out; then a quote and a trade land at index 0 and 1 while a stale trade is turned away.
2. **The gap:** three cards, valid now / valid later / valid right after, and what ERC-8421 and Trellis do with each.
3. **PARK:** a step-through scene with a DLC / deadman toggle. It autoplays, and clicking a step takes over.
4. **PRED:** the same pattern, mirrored. The PRED node queue, then a block with the slots in order.
5. **Frames:** the four frames of a parked cheque and of a trade, as a strip.
6. **Rules:** PARK-010 to 080 (built), PRED-010 to 070 (draft), each in one line.
7. **The edges:** the four honest limits. Judges respect this section.

### 2. Live console (build next, this is the demo screen)
The same visual language, but fed by real data. It's what you put on the projector.
- **Header:** devnet block height, both park nodes' health (green dot each), and gateway status.
- **Park area:** one row per entry from `GET /status` on node A and node B: trigger `(latch, event, tag)`, state (parked, promoted, evicted), and the rule behind each rejection. Rows morph from dashed to solid to struck as states change.
- **Latches:** one card per latch: UNSET, SET with tag, or EXPIRED, with the tx hash that flipped it.
- **Caps:** a small meter per sender and per trigger (`caps.perTrigger`, `caps.perEntity`). Fill it during `demo:cap` and watch entry P+1 bounce.
- **Block feed:** the same block strip as the hero, but from the RPC. Trellis transactions get their colour, everything else stays grey, and each links to the explorer.
- **PRED tab** (once PRED runs): the quote book, the trades bound to each quote with size used versus `maxSize`, and the block view with indexes.
- **Event log:** one line per admit, reject, promote and evict, with the rule id. This is the evidence for rejected transactions, which have no public record.

What it needs from the node:
- `GET /status` already exists. The console will poll it every second.
- Two small additions, which are yours to make since they're in `src/park/node.ts`: an `access-control-allow-origin` header so a browser page can read `/status`, and an event list (or a `GET /events?since=` endpoint) so the log survives a refresh.

### 3. Transaction inspector (nice to have)
Paste a tx hash and see its frames as the strip from the landing page, each with its mode, target and status from the frame receipts, plus validation gas (frames 0 and 1, not frame 0 alone). Useful when a judge asks "show me the frames".

### 4. Rules page (nice to have)
`docs/park-rule.md` and the PRED draft, rendered with the same type and a sticky rule index.

## Order of work
1. Landing page (done).
2. Live console against the local nodes, PARK only.
3. The PRED tab, once PRED is real. Until then the landing page marks PRED "draft · building".
4. Inspector, if time allows.

## Things to update before judging
- `REPO_URL` at the top of `web/main.js`.
- The status pills in the Rules section, once PRED runs.
- The hero's numbers (block heights, the 4.20 ETH payout) are illustrative. Once there's a live run, swap in real values or say "example".
