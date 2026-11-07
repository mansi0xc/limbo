import Link from "next/link";
import { ClosingMark } from "@/components/ClosingMark";
import { FlowDiagram } from "@/components/FlowDiagram";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { ArrowRight, ArrowUpRight, Dash, GitHub } from "@/components/Icons";
import { CountUp, Reveal, RevealHeading, Stagger } from "@/components/Motion";
import { Nav } from "@/components/Nav";
import { REPO, RULE_DOC } from "@/lib/links";
import { AUDIENCES } from "@/lib/impact";
import { UseCases } from "@/components/UseCases";

const METRICS = [
  { value: 1, unit: "", label: "signature", note: "signed once, ahead of time" },
  { value: 0, unit: "", label: "people online", note: "needed when it lands" },
  { value: 0, unit: "", label: "keepers to run", note: "any node holds the bytes" },
  { value: 0, unit: "", label: "consensus changes", note: "a mempool policy, no fork" },
];

const KEEPER = [
  ["Where the bytes wait", "One operator's service", "Any node running the rule; peers revalidate"],
  ["Who can submit at the trigger", "The keeper, who holds the bytes", "Any holder. The bytes are complete"],
  ["What the operator decides", "Whether, when, often to whom", "Nothing. Trigger and payouts are signed"],
  ["Mutually exclusive outcomes", "Simulate or track each one", "Held together, losers evicted from one read"],
  ["Integration", "Built per app", "One account pattern in self_verify"],
] as const;

const FRAMES = [
  {
    idx: "frame 0",
    mode: "VERIFY",
    name: "expiry_verify",
    data: "deadline: uint64",
    body: "A hard upper bound, so nothing parks forever.",
  },
  {
    idx: "frame 1",
    mode: "VERIFY",
    name: "self_verify",
    data: "(latch, eventId,\n expectedTag)",
    body: "The trigger, signed. The account approves only on a match.",
    key: true,
  },
  {
    idx: "frame 2",
    mode: "SENDER",
    name: "payout 1",
    data: "to: beneficiary\nvalue: 0.02 ETH",
    body: "Fixed at signing. No keeper picks who gets paid.",
  },
  {
    idx: "frame 3",
    mode: "SENDER",
    name: "payout 2",
    data: "optional",
    body: "More calls, same atomic transaction.",
  },
];

const RULES = [
  ["PARK-010", "Declared trigger", "Latch, event and tag live in signed self_verify data."],
  ["PARK-020", "Staked sender", "The foreign latch read is admitted only for a staked account."],
  ["PARK-030", "Template binding", "Code hash, signers and signature hash rechecked. Submitter never trusted."],
  ["PARK-040", "Expiry", "Every parked transaction carries expiry_verify past the latch deadline."],
  ["PARK-050", "Live caps", "Per-trigger P and per-entity E. Entry P+1 is rejected on arrival."],
  ["PARK-060", "Promote and evict", "Promote the match. Evict losers without simulating them."],
  ["PARK-070", "Sibling exception", "Exclusive values of one nonce slot may wait together."],
  ["PARK-080", "Optional gossip", "Peers revalidate independently. Gossip leaks timing."],
] as const;

const LIMITS = [
  ["The latch and oracle are trust points.", " PARK does not make them trustless."],
  ["A park node is a relay you hand bytes to.", " The claim is a standard behaviour, not a trustless node."],
  ["Losers die when the winner lands,", " not before."],
  ["Devnet only, unaudited.", " Chain 1337, the public alt-mempool gateway."],
] as const;

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />

        {/* How it works */}
        <section className="section wrap" id="how" aria-labelledby="how-h">
          <div className="head">
            <RevealHeading id="how-h" lines={["Signed once.", "Landed when it matters."]} />
            <Reveal delay={0.15}>
              <p>
                Some transactions should only exist after something happens, and the person who should send them
                may be asleep, offline or gone. Here is the binary DLC, start to finish.
              </p>
            </Reveal>
          </div>
          <Reveal as="figure" className="fig">
            <FlowDiagram />
            <figcaption>
              <b>Fig. 1</b>
              <span>
                One nonce key, three signed outcomes. Click a step to jump.{" "}
                <Link href="/playground" className="inline-link">
                  Run it yourself in the playground
                </Link>
                .
              </span>
            </figcaption>
          </Reveal>
        </section>

        {/* Who it's for */}
        <section className="section wrap" id="impact" aria-labelledby="impact-h">
          <div className="head">
            <RevealHeading id="impact-h" lines={["Who it’s for,", "and what changes."]} />
            <Reveal delay={0.15}>
              <p>
                Any transaction that should happen later, on a condition, is a keeper someone has to run and trust.
                Limbo removes that operator for everyone who needs one.
              </p>
            </Reveal>
          </div>
          <Stagger className="audiences">
            {AUDIENCES.map((a) => (
              <div className="audience" key={a.who}>
                <h3>{a.who}</h3>
                <p>{a.what}</p>
              </div>
            ))}
          </Stagger>
          <Reveal className="impact__cases">
            <UseCases />
            <p className="impact__note">
              The first two run end to end in this repo. The rest use the same PARK rule; each needs its own account
              template and latch, which we have not built.
            </p>
          </Reveal>
        </section>

        {/* Metrics */}
        <section className="section section--tight wrap" aria-label="By the numbers">
          <Stagger className="metrics">
            {METRICS.map((m) => (
              <div className="metric" key={m.label}>
                <div className="metric__value serif">
                  <CountUp to={m.value} />
                  {m.unit}
                </div>
                <div className="metric__label">{m.label}</div>
                <div className="metric__note">{m.note}</div>
              </div>
            ))}
          </Stagger>
        </section>

        {/* Keeper vs PARK */}
        <section className="section wrap" id="keeper" aria-labelledby="keeper-h">
          <div className="head">
            <RevealHeading id="keeper-h" lines={["Why not just", "run a keeper?"]} />
            <Reveal delay={0.15}>
              <p>
                Today every app builds or rents a bespoke service that stores signed bytes and decides when to send
                them. PARK moves that holding into mempool policy.
              </p>
            </Reveal>
          </div>
          <Reveal>
            <div className="versus" role="table" aria-label="Keeper compared with PARK">
              <div className="versus__row versus__row--head" role="row">
                <span role="columnheader" />
                <span role="columnheader">Keeper</span>
                <span role="columnheader">PARK</span>
              </div>
              {KEEPER.map(([what, keeper, park]) => (
                <div className="versus__row" role="row" key={what}>
                  <span role="rowheader">{what}</span>
                  <span role="cell">{keeper}</span>
                  <span role="cell">{park}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Anatomy */}
        <section className="section wrap" id="anatomy" aria-labelledby="anatomy-h">
          <div className="head">
            <RevealHeading id="anatomy-h" lines={["Four frames.", "One signature over all."]} />
            <Reveal delay={0.15}>
              <p>A parked cheque is an ordinary EIP-8141 frame transaction. The trick is what goes in frame 1.</p>
            </Reveal>
          </div>
          <Reveal as="figure" className="fig">
            <div className="anat">
              <Stagger className="anat__frames">
                {FRAMES.map((f) => (
                  <div className="frame" key={f.idx} data-key={!!f.key}>
                    <div className="frame__idx">
                      <span>{f.idx}</span>
                      <span className="frame__mode">{f.mode}</span>
                    </div>
                    <h3>{f.name}</h3>
                    <pre>{f.data}</pre>
                    <p>{f.body}</p>
                  </div>
                ))}
              </Stagger>
              <div className="sig">
                <span className="sig__brace" aria-hidden />
                <p>
                  <b>The signature hash covers every frame.</b> Change the trigger, the deadline or a payout and it
                  stops recovering, so a park node can hold anyone&apos;s bytes and trust none of them.
                </p>
              </div>
            </div>
            <figcaption>
              <b>Fig. 2</b>
              <span>The deadman rescue as its owner signs it. The DLC differs only in signers and payouts.</span>
            </figcaption>
          </Reveal>
        </section>

        {/* Rule */}
        <section className="section wrap" id="rule" aria-labelledby="rule-h">
          <div className="head">
            <RevealHeading id="rule-h" lines={["The PARK rule,", "in eight lines."]} />
            <Reveal delay={0.15}>
              <p>A node policy for the alt-mempool. No fork, no new opcode, no sidecar protocol.</p>
            </Reveal>
          </div>
          <Stagger className="ledger">
            {RULES.map(([id, title, body]) => (
              <div className="rule" key={id}>
                <span className="rule__id">{id}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </Stagger>
          <Reveal className="ledger__more">
            <a className="btn btn--line" href={RULE_DOC} target="_blank" rel="noreferrer">
              Read the full draft
              <ArrowUpRight className="nudge" />
            </a>
          </Reveal>
        </section>

        {/* Limits */}
        <section className="section wrap" aria-labelledby="limits-h">
          <Reveal className="limits">
            <div>
              <h2 id="limits-h">What we don&apos;t claim.</h2>
              <p>Clear edges make a rule worth adopting.</p>
            </div>
            <ul>
              {LIMITS.map(([lead, rest]) => (
                <li key={lead}>
                  <Dash />
                  <span>
                    <b>{lead}</b>
                    {rest}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* Closing */}
        <section className="closing wrap" aria-labelledby="close-h">
          <div className="closing__grid">
            <div>
              <RevealHeading
                id="close-h"
                lines={["Signed once.", "Parked safely.", <em key="l">Landed later.</em>]}
              />
              <Reveal className="closing__cta" delay={0.3}>
                <Link className="btn btn--ink" href="/playground">
                  Open the playground
                  <ArrowRight className="nudge" />
                </Link>
                <a className="btn btn--line" href={REPO} target="_blank" rel="noreferrer">
                  <GitHub />
                  Read the code
                </a>
              </Reveal>
            </div>
            <ClosingMark />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
