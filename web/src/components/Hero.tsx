"use client";

import { motion, MotionConfig } from "motion/react";
import Link from "next/link";
import { ArrowRight, GitHub } from "./Icons";
import { ContourFieldClient } from "./ContourFieldClient";
import { EASE } from "./Motion";
import { REPO } from "@/lib/links";

const rise = (delay: number) => ({
  initial: { y: "105%" },
  animate: { y: "0%" },
  transition: { duration: 1.1, ease: EASE, delay },
});

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 14, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 1, ease: EASE, delay },
});

export function Hero() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="hero" id="top">
        <motion.div
          className="hero__field"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2.4, ease: EASE, delay: 0.2 }}
        >
          <ContourFieldClient reveal="right" />
        </motion.div>
        <div className="wrap hero__in">
          <h1>
            <span className="line">
              <motion.span {...rise(0.1)}>Sign now.</motion.span>
            </span>
            <span className="line">
              <motion.span {...rise(0.22)}>
                Land <em>later.</em>
              </motion.span>
            </span>
          </h1>
          <motion.p className="hero__sub" {...fade(0.55)}>
            Limbo parks a fully signed transaction until an on-chain latch flips, then lands the exact same bytes.
            The signer can be offline. Nobody re-signs.
          </motion.p>
          <motion.div className="hero__cta" {...fade(0.68)}>
            <a className="btn btn--ink" href="#how">
              See how it works
              <ArrowRight className="nudge" />
            </a>
            <Link className="btn btn--line" href="/playground">
              Open the playground
            </Link>
            <a className="btn btn--ghost" href={REPO} target="_blank" rel="noreferrer">
              <GitHub />
              GitHub
            </a>
          </motion.div>
          <motion.p className="hero__spec" {...fade(0.85)}>
            <span>
              <b>EIP-8141</b> frame transactions
            </span>
            <span>
              <b>ERC-8421</b> alt-mempool
            </span>
            <span>
              <b>PARK</b> node policy, no fork
            </span>
          </motion.p>
        </div>
        <motion.a
          href="#how"
          className="hero__scroll"
          aria-label="Scroll to how it works"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.4 }}
        >
          <span />
        </motion.a>
      </section>
    </MotionConfig>
  );
}
