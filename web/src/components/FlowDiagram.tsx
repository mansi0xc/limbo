"use client";

import { AnimatePresence, LayoutGroup, motion, MotionConfig, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { EASE } from "./Motion";

type Phase = "sign" | "park" | "flip" | "land";
type Outcome = 1 | 2 | 3;

const PHASES: { key: Phase; label: string; ms: number; caption: (o: Outcome) => string }[] = [
  {
    key: "sign",
    label: "Sign",
    ms: 2000,
    caption: () => "Alice and Bob sign every outcome up front, each as a complete frame transaction.",
  },
  {
    key: "park",
    label: "Park",
    ms: 1900,
    caption: () => "A park node checks the signatures, the stake and the template, then holds the bytes.",
  },
  {
    key: "flip",
    label: "Flip",
    ms: 1900,
    caption: (o) =>
      o === 3 ? "Nobody attests. After the deadline, anyone calls expire()." : `The oracle attests ${NAME[o]}. The latch is now write-once.`,
  },
  {
    key: "land",
    label: "Land",
    ms: 3200,
    caption: () => "The match is promoted unchanged. Its siblings are evicted, never simulated, and can never land.",
  },
];

const NAME = ["UNSET", "YES", "NO", "EXPIRED"] as const;
const CHEQUES = [
  { tag: 1 as Outcome, name: "CET_YES", pays: "Alice ← 0.198" },
  { tag: 2 as Outcome, name: "CET_NO", pays: "Bob ← 0.198" },
  { tag: 3 as Outcome, name: "CET_REFUND", pays: "both ← 0.1" },
];
const ORDER: Outcome[] = [2, 1, 3];

function Link({ active, reverse, vertical }: { active: boolean; reverse?: boolean; vertical?: boolean }) {
  return (
    <div className="flow__link" data-vertical={vertical} aria-hidden>
      <span className="flow__line" />
      <AnimatePresence>
        {active && (
          <motion.span
            className="flow__pulse"
            initial={{ left: reverse ? "100%" : "0%", opacity: 0 }}
            animate={{ left: reverse ? ["100%", "0%"] : ["0%", "100%"], opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.15 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export function FlowDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState(0);
  const outcome = ORDER[round % ORDER.length];
  const p = PHASES[phase].key;

  useEffect(() => {
    if (!inView) return;
    const t = window.setTimeout(() => {
      if (phase === PHASES.length - 1) {
        setPhase(0);
        setRound((r) => r + 1);
      } else setPhase(phase + 1);
    }, PHASES[phase].ms);
    return () => clearTimeout(t);
  }, [phase, inView]);

  const signed = p !== "sign" ? 3 : 0;
  const latch = p === "flip" || p === "land" ? outcome : 0;

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.7, ease: EASE }}>
      <div ref={ref} className="flow">
        <LayoutGroup id="flow">
          <div className="flow__stage">
            {/* Signers */}
            <div className="flow__col flow__col--signers">
              <div className="flow__label">Signers</div>
              {["Alice", "Bob"].map((n) => (
                <div key={n} className="signer" data-on={p === "sign"}>
                  <span className="signer__dot">{n[0]}</span>
                  {n}
                </div>
              ))}
              <p className="flow__small">then go offline</p>
            </div>

            <Link active={p === "sign"} />

            {/* Park area */}
            <div className="flow__col flow__col--park">
              <div className="flow__label">Park area</div>
              <div className="flow__stack">
                {CHEQUES.map((c, i) => {
                  const landed = p === "land" && c.tag === outcome;
                  const evicted = (p === "flip" || p === "land") && c.tag !== outcome;
                  if (landed) return <div key={c.name} className="mini mini--ghost" />;
                  return (
                    <motion.div
                      key={c.name}
                      layoutId={`mini-${c.name}-${round}`}
                      className="mini"
                      data-state={evicted ? "evicted" : p === "sign" ? "signing" : "parked"}
                      initial={{ opacity: 0, x: -28 }}
                      animate={{
                        opacity: evicted ? 0.42 : 1,
                        x: 0,
                        y: evicted ? [0, -5, 0] : 0,
                      }}
                      transition={{ duration: 0.7, ease: EASE, delay: p === "sign" ? 0.35 + i * 0.32 : 0 }}
                    >
                      <span className="mini__name">{c.name}</span>
                      <span className="mini__tag">if {NAME[c.tag]}</span>
                      {evicted && (
                        <motion.span
                          className="mini__strike"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 0.6, ease: EASE, delay: 0.25 }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>
              <p className="flow__small">
                {signed ? "nonce key 1 · seq 0 · shared" : "waiting for signatures"}
              </p>
            </div>

            <Link active={p === "flip"} reverse />

            {/* Latch */}
            <div className="flow__col flow__col--latch">
              <div className="flow__label">Latch</div>
              <div className="dial" data-set={latch !== 0}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={latch}
                    className="dial__state"
                    initial={{ y: 26, opacity: 0, filter: "blur(4px)" }}
                    animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                    exit={{ y: -26, opacity: 0, filter: "blur(4px)" }}
                  >
                    {NAME[latch]}
                  </motion.span>
                </AnimatePresence>
                {latch !== 0 && (
                  <motion.span
                    key={`ring-${round}`}
                    className="dial__ring"
                    initial={{ scale: 0.6, opacity: 0.9 }}
                    animate={{ scale: 1.9, opacity: 0 }}
                    transition={{ duration: 1.2, ease: EASE }}
                  />
                )}
              </div>
              <p className="flow__small">{latch === 0 ? "write-once · unset" : "set · can never reset"}</p>
            </div>

            <Link active={p === "land"} />

            {/* Block */}
            <div className="flow__col flow__col--block">
              <div className="flow__label">Next block</div>
              <div className="slotbox">
                {p === "land" ? (
                  <motion.div
                    layoutId={`mini-${CHEQUES[outcome - 1].name}-${round}`}
                    className="mini"
                    data-state="landed"
                    transition={{ duration: 1, ease: EASE }}
                  >
                    <span className="mini__name">{CHEQUES[outcome - 1].name}</span>
                    <span className="mini__tag">{CHEQUES[outcome - 1].pays}</span>
                  </motion.div>
                ) : (
                  <span className="slotbox__empty">empty</span>
                )}
              </div>
              <p className="flow__small">{p === "land" ? "same bytes, as signed" : "nothing lands early"}</p>
            </div>
          </div>
        </LayoutGroup>

        <div className="flow__rail">
          <ol className="steps">
            {PHASES.map((ph, i) => (
              <li key={ph.key} data-state={i < phase ? "done" : i === phase ? "now" : "next"}>
                <button
                  type="button"
                  onClick={() => setPhase(i)}
                  aria-current={i === phase ? "step" : undefined}
                  className="step"
                >
                  <span className="step__bar">
                    {i === phase && (
                      <motion.span
                        key={`${round}-${phase}`}
                        className="step__fill"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: inView ? 1 : 0 }}
                        transition={{ duration: ph.ms / 1000, ease: "linear" }}
                      />
                    )}
                  </span>
                  <span className="step__label">{ph.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`${p}-${outcome}`}
              className="flow__caption"
              aria-live="polite"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              {PHASES[phase].caption(outcome)}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
