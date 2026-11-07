"use client";

import { AnimatePresence, motion } from "motion/react";
import { Diagram } from "./Diagram";

const STEPS = [
  { label: "Sign", ms: 2200, caption: "Both start the same way: a signer produces a transaction that must not land yet." },
  { label: "Wait", ms: 2200, caption: "Someone has to hold the bytes while the condition is false. A keeper is one operator; a park node is anyone running the rule." },
  { label: "Flip", ms: 2200, caption: "The latch flips. The keeper's operator now decides whether, when and to whom. The park node has nothing to decide: the trigger and payouts are signed." },
  { label: "Land", ms: 2400, caption: "The keeper resubmits, often re-signing. The park node sends the exact signed bytes." },
  { label: "Outage", ms: 3400, caption: "Take the holder down. The keeper's transaction never lands. Park node B promotes 30 s after it saw the latch settle." },
];

function Token({ show, from, to, hot }: { show: boolean; from: string; to: string; hot?: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          className="kv__token"
          data-hot={hot}
          initial={{ left: from, opacity: 0 }}
          animate={{ left: to, opacity: [0, 1, 1, 0.9] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
        />
      )}
    </AnimatePresence>
  );
}

function Node({ label, sub, state }: { label: string; sub: string; state?: "hold" | "down" | "hot" | "ok" }) {
  return (
    <div className="kv__node" data-state={state}>
      <span className="kv__label">{label}</span>
      <span className="kv__sub">{sub}</span>
    </div>
  );
}

export function KeeperVsPark() {
  return (
    <Diagram fig="Fig. 1" title="Holding a transaction until something happens" steps={STEPS}>
      {(step) => {
        const flipped = step >= 2;
        const down = step === 4;
        return (
          <div className="kv">
            <div className="kv__latch" data-set={flipped}>
              latch
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.b key={String(flipped)} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
                  {flipped ? "EXPIRED" : "UNSET"}
                </motion.b>
              </AnimatePresence>
            </div>

            <div className="kv__lane">
              <span className="kv__name">Keeper</span>
              <div className="kv__row">
                <Node label="Signer" sub="signs, hands off" />
                <div className="kv__track">
                  <Token show={step === 0} from="0%" to="100%" />
                </div>
                <Node
                  label="Keeper service"
                  sub={down ? "offline" : step >= 2 ? "decides: send? when? to whom?" : "stores bytes"}
                  state={down ? "down" : step === 1 || step === 2 ? "hold" : undefined}
                />
                <div className="kv__track">
                  <Token show={step === 3} from="0%" to="100%" />
                </div>
                <Node label="Chain" sub={down ? "nothing lands" : step === 3 ? "re-signed or resubmitted" : "waiting"} state={down ? "down" : undefined} />
              </div>
            </div>

            <div className="kv__lane">
              <span className="kv__name kv__name--park">Limbo</span>
              <div className="kv__row">
                <Node label="Signer" sub="signs, goes offline" />
                <div className="kv__track">
                  <Token show={step === 0} from="0%" to="100%" />
                </div>
                <div className="kv__pair">
                  <Node label="Park node A" sub={down ? "down" : step >= 2 ? "promotes the match" : "parked"} state={down ? "down" : step === 1 ? "hold" : step >= 2 ? "hot" : undefined} />
                  <Node label="Park node B" sub={down ? "fallback after 30 s" : "revalidated copy"} state={down ? "hot" : step === 1 ? "hold" : undefined} />
                </div>
                <div className="kv__track">
                  <Token show={step === 3 || step === 4} from="0%" to="100%" hot />
                </div>
                <Node label="Chain" sub={step >= 3 ? "same signed bytes land" : "waiting"} state={step >= 3 ? "ok" : undefined} />
              </div>
            </div>
          </div>
        );
      }}
    </Diagram>
  );
}
