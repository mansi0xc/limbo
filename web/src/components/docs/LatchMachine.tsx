"use client";

import { motion } from "motion/react";
import { Diagram } from "./Diagram";

/**
 * The latch as a state machine plus its time axis.
 * One terminal transition per run, cycling YES → NO → EXPIRED across rounds.
 */
const STEPS = [
  { label: "Open", ms: 2200, caption: "Every event starts UNSET. A fixed event gets a deadline D once, with open(). A heartbeat event moves D forward with each ping()." },
  { label: "Window", ms: 2600, caption: "Before D the oracle may attest YES or NO, on fixed events only. Between D and D + g nothing can happen: that is the grace period." },
  { label: "Settle", ms: 2600, caption: "One transition fires. Attest before D, or anyone calls expire() after D + g." },
  { label: "Locked", ms: 2400, caption: "The state is write-once. Every transition starts from UNSET, so nothing can move it again." },
];

const OUTCOMES = [
  { tag: "YES", t: 0.32 },
  { tag: "NO", t: 0.4 },
  { tag: "EXPIRED", t: 0.86 },
] as const;

export function LatchMachine() {
  return (
    <Diagram fig="Fig. 2" title="The latch: four states, one write" steps={STEPS}>
      {(step, round) => {
        const o = OUTCOMES[round % 3];
        const settled = step >= 2;
        const cursor = step === 0 ? 0.08 : step === 1 ? 0.62 : o.t;
        const edge = (tag: string) => settled && o.tag === tag;
        return (
          <div className="lm">
            <svg viewBox="0 0 640 260" className="lm__svg" aria-hidden>
              <defs>
                <marker id="lm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 10 5 0 10z" fill="currentColor" />
                </marker>
              </defs>
              {/* ping loop */}
              <motion.path
                d="M120 102 C 90 40, 190 40, 160 102"
                className="lm__edge"
                data-on={step <= 1}
                markerEnd="url(#lm-arrow)"
              />
              <text x="140" y="34" className="lm__elabel" textAnchor="middle">
                ping() · owner · D ← now + interval
              </text>

              {[
                { tag: "YES", y: 50, d: "M200 120 C 300 120, 340 58, 438 58", label: "attest(true) · oracle · t ≤ D" },
                { tag: "NO", y: 130, d: "M200 130 L 438 130", label: "attest(false) · oracle · t ≤ D" },
                { tag: "EXPIRED", y: 210, d: "M200 140 C 300 140, 340 202, 438 202", label: "expire() · anyone · t > D + g" },
              ].map((e) => (
                <g key={e.tag}>
                  <path d={e.d} className="lm__edge" data-on={edge(e.tag)} markerEnd="url(#lm-arrow)" />
                  {edge(e.tag) && (
                    <motion.circle
                      r="4"
                      className="lm__pulse"
                      initial={{ offsetDistance: "0%" }}
                      animate={{ offsetDistance: "100%" }}
                      transition={{ duration: 1, ease: [0.65, 0, 0.35, 1] }}
                      style={{ offsetPath: `path("${e.d}")` }}
                    />
                  )}
                  <text x="320" y={e.tag === "YES" ? 76 : e.tag === "NO" ? 122 : 188} className="lm__elabel" textAnchor="middle">
                    {e.label}
                  </text>
                </g>
              ))}

              <g className="lm__state" data-on={!settled}>
                <rect x="60" y="100" width="140" height="56" rx="4" />
                <text x="130" y="134" textAnchor="middle">UNSET</text>
              </g>
              {[
                { tag: "YES", y: 32 },
                { tag: "NO", y: 104 },
                { tag: "EXPIRED", y: 176 },
              ].map((s) => (
                <g key={s.tag} className="lm__state" data-on={edge(s.tag)} data-dim={settled && !edge(s.tag)}>
                  <rect x="440" y={s.y} width="150" height="52" rx="4" />
                  <text x="515" y={s.y + 32} textAnchor="middle">
                    {s.tag}
                  </text>
                  {edge(s.tag) && step === 3 && (
                    <motion.text
                      x="602"
                      y={s.y + 31}
                      className="lm__lock"
                      initial={{ opacity: 0, x: 596 }}
                      animate={{ opacity: 1, x: 602 }}
                    >
                      final
                    </motion.text>
                  )}
                </g>
              ))}
            </svg>

            <div className="lm__axis">
              <div className="lm__zone lm__zone--attest">attest window (fixed events)</div>
              <div className="lm__zone lm__zone--grace">grace g</div>
              <div className="lm__zone lm__zone--expire">expire() allowed</div>
              <span className="lm__tick" style={{ left: "58%" }}>
                D
              </span>
              <span className="lm__tick" style={{ left: "74%" }}>
                D + g
              </span>
              <motion.span className="lm__now" animate={{ left: `${cursor * 100}%` }} transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}>
                now
              </motion.span>
            </div>
          </div>
        );
      }}
    </Diagram>
  );
}
