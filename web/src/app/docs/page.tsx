import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { AdmissionGates } from "@/components/docs/AdmissionGates";
import { DeadmanTimeline } from "@/components/docs/DeadmanTimeline";
import { FrameSeal } from "@/components/docs/FrameSeal";
import { KeeperVsPark } from "@/components/docs/KeeperVsPark";
import { LatchMachine } from "@/components/docs/LatchMachine";
import { M, MathBlock } from "@/components/docs/Math";
import { NonceSlot } from "@/components/docs/NonceSlot";
import { Toc, type TocItem } from "@/components/docs/Toc";
import { REPO, RULE_DOC, RUNBOOK } from "@/lib/links";
import { AUDIENCES, USE_CASES } from "@/lib/impact";

export const metadata: Metadata = {
  title: "Docs — Limbo",
  description:
    "How Limbo works: the problem, the PARK rule, the latch, admission, promotion and eviction, the maths behind the bounds, the two workloads, and the limits.",
};

const TOC: TocItem[] = [
  { id: "overview", label: "Limbo in one minute" },
  { id: "problem", label: "The problem" },
  { id: "uses", label: "Who it’s for" },
  { id: "blocks", label: "Building blocks" },
  { id: "latch", label: "The latch" },
  { id: "anatomy", label: "Anatomy of a parked transaction" },
  { id: "admission", label: "Admission" },
  { id: "promotion", label: "Promotion and eviction" },
  { id: "maths", label: "The maths" },
  { id: "m-time", label: "Timing bounds", sub: true },
  { id: "m-excl", label: "Mutual exclusion", sub: true },
  { id: "m-solv", label: "Solvency", sub: true },
  { id: "m-caps", label: "Caps and griefing", sub: true },
  { id: "m-live", label: "Liveness", sub: true },
  { id: "m-cost", label: "Cost of eviction", sub: true },
  { id: "workloads", label: "The two workloads" },
  { id: "security", label: "Security model" },
  { id: "limits", label: "Limits" },
  { id: "next", label: "What comes next" },
  { id: "glossary", label: "Glossary" },
];

const THREATS = [
  ["Change a payout or the trigger after signing", "The signature hash covers every frame, so the signature stops recovering (PARK-030)."],
  ["Replay one cheque to fill the caps", "Duplicates are matched by transaction hash and never counted twice (PARK-050)."],
  ["Submit a cheque whose declared trigger lies", "The node decodes the trigger from the signed self_verify data and compares (PARK-010)."],
  ["Send the rescue to someone else", "self_verify reads the transaction's own frames: at least the rescue amount to the beneficiary, nothing anywhere else."],
  ["Abort a DLC without marking it aborted", "The ABORT cheque must carry markAborted() and only zero-value self-calls, checked by frame introspection."],
  ["Dust-deposit to block the other side's abort", "A side counts as funded only at its full stake, and deposits are capped at the stake."],
  ["Oracle freezes a deadman account", "attest() only works on fixed-deadline events. A heartbeat event can only end EXPIRED."],
  ["Owner drains the account after it expires", "withdraw() is blocked while a rescue is pending: EXPIRED, not yet rescued, inside the window."],
  ["A losing sibling lands too", "It shares the winner's nonce slot, which the winner consumed."],
  ["The promoting node goes down", "Node B promotes 30 s after it saw the latch settle. Both nodes persist their park area."],
] as const;

const GLOSSARY = [
  ["Latch", "A write-once contract. Each event reads UNSET until exactly one transition to YES, NO or EXPIRED."],
  ["Trigger", "The tuple (latch, eventId, expectedTag) a parked transaction depends on, signed inside self_verify."],
  ["Cheque", "A fully signed frame transaction that waits on a trigger. Our word, not the EIP's."],
  ["Park node", "A node that admits, holds, revalidates and promotes parked transactions."],
  ["Park area", "The node's set of parked transactions. Separate from the live mempool."],
  ["Sibling", "Another signed value of the same (sender, nonce key, nonce seq). At most one can ever land."],
  ["Template", "An allow-listed account: address, code hash, latch, event, allowed tags and signers."],
  ["Promotion", "Sending a parked transaction's exact bytes to the live mempool once its tag matches."],
  ["Eviction", "Dropping a parked transaction that can no longer land. Never simulated."],
] as const;

export default function Docs() {
  return (
    <>
      <Nav />
      <main className="wrap docs">
        <aside className="docs__aside">
          <Toc items={TOC} />
        </aside>

        <article className="prose">
          <header className="docs__head" id="overview">
            <p className="docs__crumb">
              Documentation · rule <a href={RULE_DOC}>PARK-010…080</a> · reference implementation on{" "}
              <a href={REPO}>GitHub</a>
            </p>
            <h1>Limbo, explained.</h1>
            <p className="lede">
              Limbo lets a fully signed Ethereum transaction wait until something happens on chain, then land as the
              exact same bytes. Nobody has to be online when it happens, nobody re-signs, and nobody gets to decide
              who is paid.
            </p>
            <div className="tldr">
              <div>
                <b>What</b>
                <span>A node policy, PARK, for the EIP-8141 / ERC-8421 alternative mempool.</span>
              </div>
              <div>
                <b>How</b>
                <span>The transaction signs its own trigger. Nodes hold it, watch a write-once latch, and promote the match.</span>
              </div>
              <div>
                <b>Why it is different</b>
                <span>No fork, no keeper, no simulation of losing outcomes. One nonce key decides which outcome lands.</span>
              </div>
            </div>
          </header>

          <section id="problem">
            <h2>The problem</h2>
            <p>
              Some transactions should only exist after something happens. A will that pays out when its owner stops
              checking in. A bet that pays whoever was right. A refund that only applies if nobody showed up. The
              person who should send them may be asleep, offline, or gone by the time the condition comes true.
            </p>
            <p>
              Ethereum&apos;s mempools have two answers for a transaction: admit it or reject it. A transaction that
              is invalid now but will be valid later has nowhere to wait. So today every app builds or rents a{" "}
              <em>keeper</em>: an off-chain service that stores the signed bytes or a key, watches the chain, and
              decides when to resubmit. The keeper is a single operator, it is trusted with timing and often with
              the recipient, and when it is down nothing lands.
            </p>
            <KeeperVsPark />
            <p>
              Limbo moves the waiting into mempool policy. Any node that runs the rule can hold the bytes, every peer
              revalidates them independently, and the outcome is fixed the moment the transaction is signed.
            </p>
          </section>

          <section id="uses">
            <h2>Who it&apos;s for</h2>
            <p>
              Every conditional or posthumous transaction today implies a keeper: a service someone runs, pays for and
              trusts with timing. Limbo takes that operator out, for these people:
            </p>
            <dl className="defs">
              {AUDIENCES.map((a) => (
                <div key={a.who}>
                  <dt>{a.who}</dt>
                  <dd>{a.what}</dd>
                </div>
              ))}
            </dl>
            <h3>Use cases</h3>
            <p>
              The first two are built and run end to end in the repo. The others use the same rule; each would need its
              own account template and latch.
            </p>
            <div className="cases">
              {USE_CASES.map((u) => (
                <div className="case" key={u.id}>
                  <div className="case__head">
                    <h4>{u.title}</h4>
                    <span className="uc__tag" data-status={u.status}>
                      {u.status === "demoed" ? "Built and demoed" : "Same rule"}
                    </span>
                  </div>
                  <p className="case__who">{u.who}</p>
                  <div className="case__cmp">
                    <p>
                      <b>Today.</b> {u.today}
                    </p>
                    <p>
                      <b>With Limbo.</b> {u.limbo}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="blocks">
            <h2>Building blocks</h2>
            <p>Limbo does not add a new primitive. It composes three that already exist on the devnet.</p>
            <dl className="defs">
              <div>
                <dt>EIP-8141 frame transactions</dt>
                <dd>
                  A transaction is a list of frames. <code>VERIFY</code> frames run validation and may call{" "}
                  <code>APPROVE</code>; <code>SENDER</code> frames run as the account. Validation can read the
                  transaction&apos;s own frames through introspection opcodes, which Limbo uses to make a signer include
                  what they might otherwise leave out.
                </dd>
              </div>
              <div>
                <dt>ERC-8421 alternative mempool</dt>
                <dd>
                  The canonical mempool refuses validation that reads another contract&apos;s storage. The alternative
                  mempool admits such a <em>foreign read</em> for a <em>staked</em> sender. Reading a shared latch is
                  exactly that.
                </dd>
              </div>
              <div>
                <dt>EIP-8250 keyed nonces</dt>
                <dd>
                  An account has many nonce keys, each with its own sequence. Several transactions can be signed for
                  the same <M>{"(\\text{key}, \\text{seq})"}</M> slot; only one can ever be included. Limbo uses this
                  as its exclusion mechanism.
                </dd>
              </div>
            </dl>
          </section>

          <section id="latch">
            <h2>The latch</h2>
            <p>
              A latch is a small shared contract. For each event it holds one of four states, and it changes state at
              most once. That write-once property is what lets a node reason about a transaction without running it.
            </p>
            <LatchMachine />
            <p>
              There are two kinds of event. A <strong>fixed</strong> event is opened with a deadline{" "}
              <M>{"D"}</M>; before <M>{"D"}</M> its oracle can attest YES or NO. A <strong>heartbeat</strong> event
              has no oracle: its owner calls <code>ping()</code>, which moves <M>{"D"}</M> to{" "}
              <M>{"\\text{now} + \\Delta"}</M>, and the event can only ever end EXPIRED. For either kind, once{" "}
              <M>{"D + g"}</M> has passed anyone may call <code>expire()</code>.
            </p>
          </section>

          <section id="anatomy">
            <h2>Anatomy of a parked transaction</h2>
            <p>
              A parked transaction is an ordinary frame transaction. The only unusual thing is what goes in its first{" "}
              <code>VERIFY</code> frame: the trigger, ABI-encoded as <code>(address latch, bytes32 eventId, uint8 expectedTag)</code>.
              Because that frame is signed, the trigger is part of the signature.
            </p>
            <pre className="codeblock">
              {`[ expiry_verify(E),                 // 0  VERIFY  hard upper bound
  self_verify(latch, eventId, tag),  // 1  VERIFY  the signed trigger
  sender(self.markRescued()),        // 2  SENDER  rescue and abort only
  sender(payout 1),                  // 3  SENDER
  sender(payout 2) ]                 // 4  SENDER  optional`}
            </pre>
            <FrameSeal />
            <p>
              Inside <code>self_verify</code> the account reads the latch, checks that the resolved signers are its own,
              checks there is room for the payouts plus gas, and only then approves execution and payment. For the
              rescue and the DLC abort it also reads its own frames and refuses a transaction that leaves out the
              required self-call or pays anyone it should not.
            </p>
          </section>

          <section id="admission">
            <h2>Admission</h2>
            <p>
              A park node never trusts the submitter. Before it holds anything it rebuilds every fact it needs from
              the signed bytes and from chain state, cheapest checks first. A transaction that fails any of them is
              rejected with the rule that caught it.
            </p>
            <AdmissionGates />
            <ol className="checks">
              <li>
                <b>Template.</b> The sender is an allow-listed account with the expected code hash, on the right chain.
              </li>
              <li>
                <b>Signed trigger.</b> The trigger decoded from <code>self_verify</code> matches the template&apos;s
                latch, event and allowed tags, and matches what the submitter declared.
              </li>
              <li>
                <b>Expiry.</b> An <code>expiry_verify</code> frame is present and its bound clears the latch deadline
                plus grace plus a margin.
              </li>
              <li>
                <b>Signatures.</b> The signature hash is recomputed from the bytes and each entry recovers to the
                template&apos;s signer, in order, over the canonical message.
              </li>
              <li>
                <b>Duplicate.</b> Bytes the node already holds are rejected and not counted.
              </li>
              <li>
                <b>Latch and stake.</b> The latch is still UNSET, and the sender is staked above the minimum with no
                withdrawal pending.
              </li>
              <li>
                <b>Caps.</b> At most <M>{"P = 4"}</M> parked per trigger and <M>{"E = 8"}</M> per account.
              </li>
            </ol>
          </section>

          <section id="promotion">
            <h2>Promotion and eviction</h2>
            <p>
              The node indexes everything it holds by trigger. When a latch changes it reads the new state once, then
              sorts its entries into two piles: those whose tag matches, which it promotes, and those whose tag does
              not, which it evicts without ever simulating them.
            </p>
            <NonceSlot />
            <p>
              Within one sibling group, the node promotes at most one entry. A promotion that fails for a transient
              reason is retried with exponential backoff. One that can never succeed, because it was mined with a
              failed frame or its nonce is already used, is marked failed and its siblings evicted.
            </p>
            <p>
              The reference deployment runs two nodes. Node A promotes as soon as the latch settles. Node B promotes a
              matching entry that is still parked 30 seconds after it saw the settlement. Both persist their park area
              to disk and reload it on start.
            </p>
          </section>

          <section id="maths">
            <h2>The maths</h2>
            <p>
              Limbo&apos;s guarantees are small inequalities. Here they are in one place, with the values the
              reference deployment uses. Notation: <M>{"t"}</M> is block time, <M>{"D"}</M> the latch deadline,{" "}
              <M>{"g"}</M> the grace period, <M>{"T"}</M> a cheque&apos;s expiry bound, <M>{"P"}</M> and{" "}
              <M>{"E"}</M> the per-trigger and per-entity caps.
            </p>

            <h3 id="m-time">Timing bounds</h3>
            <p>A latch transition is only possible in two disjoint windows, separated by the grace period.</p>
            <MathBlock label="latch">
              {"\\texttt{attest}:\\; t \\le D \\;\\wedge\\; \\text{fixed} \\qquad \\texttt{expire}:\\; t > D + g"}
            </MathBlock>
            <p>
              So nothing can settle an event during <M>{"(D,\\, D+g]"}</M>. A node only parks a cheque whose expiry
              clears that gap with a margin <M>{"m"}</M>, otherwise the cheque could die before it can ever become
              valid:
            </p>
            <MathBlock label="PARK-040">{"T \\;>\\; D + g + m, \\qquad m = 60\\,\\text{s}"}</MathBlock>
            <p>
              The reference signs <M>{"T = D + 3600\\,\\text{s}"}</M>. For a heartbeat event each ping sets{" "}
              <M>{"D_{k+1} = t_k + \\Delta"}</M> with <M>{"\\Delta = 60\\,\\text{s}"}</M>, so a rescue signed against an
              early deadline stays useful only while
            </p>
            <MathBlock>{"D_k + g + m \\;<\\; T"}</MathBlock>
            <p>
              An owner who keeps pinging for more than an hour therefore re-signs and re-parks the rescue, or signs
              with a longer expiry. The rescue account reserves its balance for a window <M>{"W"}</M> after the
              deadline:
            </p>
            <MathBlock label="window">{"W = g + T_{\\text{cheque}} + 300 = 10 + 3600 + 300 = 3910\\,\\text{s}"}</MathBlock>
            <MathBlock label="locked">
              {"\\text{locked} \\iff \\text{state} = \\text{EXPIRED} \\;\\wedge\\; \\neg\\text{rescued} \\;\\wedge\\; t \\le D + W"}
            </MathBlock>
            <p>
              Because the deadline only ever moves forward, every parked rescue satisfies{" "}
              <M>{"T \\le D + T_{\\text{cheque}} < D + W"}</M>: the reservation outlives every copy that could still
              land, and then releases the funds.
            </p>
            <DeadmanTimeline />

            <h3 id="m-excl">Mutual exclusion</h3>
            <p>
              Let a sibling set <M>{"S"}</M> be every signed transaction for one slot{" "}
              <M>{"(\\text{sender}, k, s)"}</M>. Inclusion requires the slot&apos;s sequence to equal <M>{"s"}</M>, and
              inclusion advances it:
            </p>
            <MathBlock label="EIP-8250">
              {"\\text{include}(x) \\implies \\text{seq}_k = s \\;\\text{ and then }\\; \\text{seq}_k \\leftarrow s + 1"}
            </MathBlock>
            <MathBlock label="exclusion">{"\\bigl|\\, S \\cap \\text{included} \\,\\bigr| \\;\\le\\; 1"}</MathBlock>
            <p>
              The latch adds a second, independent filter. A cheque with tag <M>{"\\tau"}</M> passes{" "}
              <code>self_verify</code> only if the latch reads <M>{"\\tau"}</M>, and a write-once latch reads at most
              one terminal value, ever. So among outcome siblings with distinct tags at most one is ever even valid,
              and the nonce makes that true even for two cheques on the same tag.
            </p>

            <h3 id="m-solv">Solvency</h3>
            <p>
              Neither account can approve a payout it cannot fund. The DLC caps each side&apos;s deposit at its stake,
              counts as funded only when both stakes are met, and its constructor refuses payouts larger than the
              stakes:
            </p>
            <MathBlock label="DLC">
              {"d_i \\le s_i, \\qquad \\text{funded} \\iff d_A \\ge s_A \\wedge d_B \\ge s_B, \\qquad p_A + p_B \\le s_A + s_B"}
            </MathBlock>
            <MathBlock label="outcome">{"\\text{balance} \\;\\ge\\; p_A + p_B + b"}</MathBlock>
            <p>
              With the reference values the room is exact:{" "}
              <M>{"0.099 + 0.099 + 0.002 = 0.200 = 0.1 + 0.1"}</M> ETH. The buffer <M>{"b"}</M> is precisely the gap
              between the stakes and the payouts. The rescue is the same shape with one payee, and its frames must
              send the beneficiary at least <M>{"R"}</M> and nobody anything else:
            </p>
            <MathBlock label="rescue">
              {"\\text{balance} \\ge R + b, \\qquad \\textstyle\\sum \\text{to beneficiary} \\ge R, \\qquad \\textstyle\\sum \\text{to others} = 0"}
            </MathBlock>
            <p>
              with <M>{"R = 0.02"}</M> and <M>{"b = 0.002"}</M> ETH. Frames only count if they carry enough gas to
              actually run: 25,000 for the marking self-call, 10,000 for a payout.
            </p>

            <h3 id="m-caps">Caps and griefing</h3>
            <p>The caps bound what a node holds, whatever anyone submits:</p>
            <MathBlock label="PARK-050">
              {"\\bigl|\\text{park}(\\tau)\\bigr| \\le P = 4, \\qquad \\bigl|\\text{park}(e)\\bigr| \\le E = 8"}
            </MathBlock>
            <p>
              Duplicates are matched by transaction hash, so <M>{"n"}</M> replays of one cheque count as one. Without
              that, anyone who saw the bytes could replay a single outcome until the per-entity cap blocked the
              others.
            </p>
            <p>
              Honestly: today&apos;s caps are first-come. Since <M>{"E \\ge P"}</M>, one staked account can fill a
              trigger, so the cost to occupy it is a single minimum stake (0.01 ETH on the devnet). The v2 draft ranks
              entries by stake instead, which makes occupying a slot cost stake linear in the slots taken:
            </p>
            <MathBlock label="v2">{"\\text{cost}(\\text{occupy } j \\text{ slots}) \\;\\approx\\; \\sum_{i=1}^{j} \\text{stake}_i \\;>\\; \\sum \\text{incumbent stakes displaced}"}</MathBlock>

            <h3 id="m-live">Liveness</h3>
            <p>A transient promotion failure is retried with a doubling delay, capped:</p>
            <MathBlock label="backoff">
              {"\\delta_n = \\min\\!\\bigl(2000 \\cdot 2^{\\,n-1},\\; 60\\,000\\bigr)\\ \\text{ms} \\;=\\; 2, 4, 8, 16, 32, 60, 60, \\ldots\\ \\text{s}"}
            </MathBlock>
            <p>
              Node B promotes a still-parked match at <M>{"t^{B}_{\\text{settle}} + 30\\,\\text{s}"}</M>. A cheque
              lands if at least one node is up before it expires. Two nodes sending the same bytes is harmless: by
              the exclusion bound, at most one copy can be included.
            </p>

            <h3 id="m-cost">Cost of eviction</h3>
            <p>
              A keeper with <M>{"k"}</M> mutually exclusive transactions has to simulate them to learn which is
              valid. A park node reads one storage value and simulates only the winner, at promotion:
            </p>
            <MathBlock label="per trigger">
              {"\\text{keeper} \\approx k \\cdot c_{\\text{sim}} \\qquad\\text{vs}\\qquad \\text{PARK} = c_{\\text{read}} + c_{\\text{sim}}"}
            </MathBlock>
            <p>The work per settlement is constant in the number of siblings.</p>
          </section>

          <section id="workloads">
            <h2>The two workloads</h2>
            <h3 id="deadman">Deadman rescue</h3>
            <p>
              The owner funds a staked account, signs one rescue that pays a beneficiary if the account&apos;s
              heartbeat latch ever reads EXPIRED, and parks it. They keep pinging. If they stop, the deadline passes,
              grace passes, any stranger calls <code>expire()</code>, and the park node promotes the rescue. The
              owner is not online at the trigger and no keeper chooses the beneficiary. This is the case Limbo exists
              for: nobody who could submit is around.
            </p>
            <h3 id="dlc">Binary DLC</h3>
            <p>
              Alice and Bob fund a 2-of-2 account up to fixed stakes and sign three outcomes on one nonce slot:{" "}
              <code>CET_YES</code>, <code>CET_NO</code> and <code>CET_REFUND</code>. The oracle attests, the match is
              promoted, the slot is consumed and the other two are dead. If one side never funds, the other can abort
              with a single signature, which must mark the account aborted; each party then claims back its own
              deposit.
            </p>
            <p>
              A single DLC does not strictly need parking: both parties are online and the winner can submit. It is
              here because it is the smallest real sibling set. That is what PARK-060 and PARK-070 are about.{" "}
              <Link href="/playground">Flip both latches in the playground.</Link>
            </p>
          </section>

          <section id="security">
            <h2>Security model</h2>
            <p>What an adversary might try, and what stops them.</p>
            <div className="versus versus--two" role="table" aria-label="Threats and defences">
              <div className="versus__row versus__row--head" role="row">
                <span role="columnheader">Attempt</span>
                <span role="columnheader">Defence</span>
              </div>
              {THREATS.map(([a, d]) => (
                <div className="versus__row" role="row" key={a}>
                  <span role="rowheader">{a}</span>
                  <span role="cell">{d}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="limits">
            <h2>Limits</h2>
            <ul className="bul">
              <li>The latch and its oracle are trust points. Limbo does not make them trustless.</li>
              <li>A park node is a relay you hand bytes to. The claim is a standard, permissionless behaviour, not a trustless node.</li>
              <li>The winner can still submit after the trigger. A loser is invalid only once the winner lands.</li>
              <li>Admission uses per-deploy templates, not an interface any account can implement.</li>
              <li>Caps are first-come, and losers are evicted without waiting for reorg safety.</li>
              <li>Gossip leaks the trigger and timing. There is no privacy claim.</li>
              <li>The frame-introspection opcodes are mocked in Foundry and only exercised on the devnet.</li>
              <li>Devnet only, unaudited.</li>
            </ul>
          </section>

          <section id="next">
            <h2>What comes next</h2>
            <p>
              The <a href={`${REPO}/blob/main/docs/park-rule-v2-draft.md`}>v2 draft</a> is written but not implemented:
            </p>
            <ul className="bul">
              <li>
                <b>Interface-based admission.</b> Any account exposing <code>trigger()</code> and{" "}
                <code>requiredSigners()</code> can be parked, with no per-deploy node configuration.
              </li>
              <li>
                <b>Caps ranked by stake.</b> Occupying a trigger costs stake linear in the slots taken.
              </li>
              <li>
                <b>Reorg-safe eviction.</b> Losing siblings are kept until the winner is confirmed.
              </li>
              <li>
                <b>Fee ladders.</b> The same outcome signed at several fee caps, so a parked transaction stays
                includable when the base fee moves.
              </li>
            </ul>
          </section>

          <section id="glossary">
            <h2>Glossary</h2>
            <dl className="defs defs--tight">
              {GLOSSARY.map(([t, d]) => (
                <div key={t}>
                  <dt>{t}</dt>
                  <dd>{d}</dd>
                </div>
              ))}
            </dl>
            <div className="docs__end">
              <Link className="btn btn--ink" href="/playground">
                Open the playground
              </Link>
              <a className="btn btn--line" href={RUNBOOK}>
                Run it on the devnet
              </a>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
