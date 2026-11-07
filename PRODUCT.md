# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + TypeScript, in `web/` at the repo root. Chosen by the user so the landing page can later grow into a park-node / cheque dashboard.

## Users

1. **ETHGlobal judges and EF reviewers** (primary, Mumbai 2026, Frame Transaction Alt Mempool track). They skim dozens of projects; they need to grasp what PARK is and why it matters in about a minute, then open the repo and the rule draft.
2. **Wallet, account-abstraction, and infra developers** who might adopt the rule. They want to clone the repo and run the deadman and DLC demos on the public devnet.

## Product Purpose

Limbo is a reference implementation of latch-triggered parked frame transactions on the EIP-8141 / ERC-8421 alt-mempool. A fully signed transaction waits ("parks") in a park node until an on-chain latch changes state, then the node promotes the unchanged bytes to the mempool. Success: a reader understands that a signed transaction can land later, on a condition, with nobody online and no keeper re-signing.

## Positioning

PARK is a node policy, not a consensus change. The trigger is signed inside the transaction's own `self_verify` frame, so park nodes verify instead of trusting the submitter, and sibling cheques sharing one EIP-8250 nonce key make outcomes mutually exclusive. Two workloads prove it: a deadman rescue that lands when the owner goes silent, and a binary DLC where one shared nonce key settles the winner and invalidates the siblings.

## Operating Context

- Rule IDs PARK-010 through PARK-080 (`docs/park-rule.md`).
- Frame layout: `[expiry_verify(deadline), self_verify(trigger), sender(payout 1), sender(payout 2)]`.
- Latch states: UNSET, YES, NO, EXPIRED (write-once). Heartbeat `ping` mode and fixed-deadline `open` mode.
- Two reference park nodes (A promotes, B revalidates via gossip), per-trigger cap P and per-entity cap E.
- Public devnet chain 1337, gateway `altmempoolgateway.forshtat.com/rpc`, explorer `explorer.altmempool.wtf`.
- Commands: `yarn deploy`, `yarn park:a`, `yarn park:b`, `yarn demo:deadman`, `yarn demo:dlc`, `yarn demo:cap`, `yarn measure`.
- Repo: github.com/mansi0xc/limbo.

## Capabilities and Constraints

- Devnet-only, unaudited. The latch and oracle are trust points; the rule does not make them trustless.
- The park node is a reference relay. Gossip leaks trigger and timing; no privacy claim.
- The loser of a DLC is invalid only once the winner lands.
- Undecided: hosted demo, video, real devnet tx hashes to showcase.

## Brand Commitments

Name: Limbo. Rule name: PARK. Voice from the README: plain, exact, honest about limits. Avoid generic crypto aesthetics and hype copy (user, explicit).

Standing preference (user, 2026-11-07): the category-standard path in a research-paper flavor (Paradigm / Flashbots craft level), light paper ground, serif headlines, ruled mechanism diagrams, but punchy copy rather than an essay tone. Shaders (shaders.com library) are wanted as tasteful, non-gimmicky moments.

## Evidence on Hand

- Foundry and Vitest suites in the repo; rule draft in `docs/park-rule.md`; runbook in `docs/demo-runbook.md`.
- No demo video, no published tx hashes, no users, no benchmarks. Any transaction data on the page is illustrative and must be labelled as such.

## Product Principles

1. Show the mechanism, don't describe it: a parked cheque waiting on a latch is the whole idea.
2. Honest by default: limits and trust points are stated, not hidden.
3. Verify, don't trust: every claim maps to a rule ID or a line of code.
4. Judges first, builders right behind: one minute to understand, one click to the repo.
