import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { LatchSimulator } from "@/components/LatchSimulator";
import { Reveal, RevealHeading } from "@/components/Motion";
import { Nav } from "@/components/Nav";
import { Terminal } from "@/components/RunIt";
import { ContourFieldClient } from "@/components/ContourFieldClient";
import { README, RULE_DOC, RUNBOOK } from "@/lib/links";

export const metadata: Metadata = {
  title: "Playground — Limbo",
  description: "Flip the latch yourself: a browser simulation of a Limbo park node running the DLC and deadman workloads.",
};

export default function Playground() {
  return (
    <>
      <Nav />
      <main>
        <section className="pg-hero">
          <div className="pg-hero__field" aria-hidden>
            <ContourFieldClient reveal="right" seed={31} levels={10} spread={2.3} />
          </div>
          <div className="wrap pg-hero__in">
            <RevealHeading as="h1" lines={["Flip the latch."]} />
            <Reveal delay={0.15}>
              <p>
                A park node, a latch and a block, in your browser. Try sending a cheque early, then flip the latch and
                see which bytes survive.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="wrap" aria-label="Simulator">
          <Reveal as="figure" className="fig">
            <LatchSimulator />
            <figcaption>
              <b>Simulation.</b>
              <span>
                Hashes, blocks and balances are illustrative. The admission, promotion and eviction logic mirrors the
                reference park node.
              </span>
            </figcaption>
          </Reveal>
        </section>

        <section className="section wrap" id="run" aria-labelledby="run-h">
          <div className="run">
            <div className="run__copy">
              <RevealHeading id="run-h" lines={["Now run it", "on the devnet."]} />
              <Reveal delay={0.15}>
                <p>Contracts, two park nodes and three demos, from clone to a landed rescue.</p>
              </Reveal>
              <Reveal delay={0.25}>
                <nav className="run__links" aria-label="Documentation">
                  <a href={README} target="_blank" rel="noreferrer">
                    README <span>quick start</span>
                  </a>
                  <a href={RUNBOOK} target="_blank" rel="noreferrer">
                    Demo runbook <span>expected output</span>
                  </a>
                  <a href={RULE_DOC} target="_blank" rel="noreferrer">
                    PARK rule draft <span>docs/park-rule.md</span>
                  </a>
                </nav>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <Terminal />
            </Reveal>
          </div>
        </section>
        <div className="spacer" />
      </main>
      <Footer />
    </>
  );
}
