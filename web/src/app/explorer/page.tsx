import type { Metadata } from "next";
import { ContourFieldClient } from "@/components/ContourFieldClient";
import { Footer } from "@/components/Footer";
import { Reveal, RevealHeading } from "@/components/Motion";
import { Nav } from "@/components/Nav";
import { ParkExplorer } from "@/components/ParkExplorer";

export const metadata: Metadata = {
  title: "Explorer — Limbo",
  description:
    "Watch two live park nodes hold signed cheques at a latch, evict the losers, and promote the winner — with a fallback node that takes over when the primary is down.",
};

export default function Explorer() {
  return (
    <>
      <Nav />
      <main>
        <section className="pg-hero">
          <div className="pg-hero__field" aria-hidden>
            <ContourFieldClient reveal="right" seed={47} levels={10} spread={2.1} />
          </div>
          <div className="wrap pg-hero__in">
            <RevealHeading as="h1" lines={["Watch the park."]} />
            <Reveal delay={0.15}>
              <p>
                Two real park nodes, read live. Cheques wait at the latch, losers drop out, the winner lands. Stop node A
                and watch B take over.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="wrap" aria-label="Park explorer">
          <Reveal as="figure" className="fig">
            <ParkExplorer />
            <figcaption>
              <b>Live.</b>
              <span>
                Every row comes from the nodes&apos; <code>/status</code> endpoints and the latch on chain. Run the
                nodes locally; this page only reads.
              </span>
            </figcaption>
          </Reveal>
        </section>
        <div className="spacer" />
      </main>
      <Footer />
    </>
  );
}
