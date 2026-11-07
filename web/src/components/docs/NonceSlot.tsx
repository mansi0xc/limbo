"use client";

import { LayoutGroup, motion } from "motion/react";
import { Diagram } from "./Diagram";

const STEPS = [
  { label: "Siblings", ms: 2600, caption: "Three outcomes, one slot: (sender, key 1, seq 0). The live mempool would accept only one, so they can only wait together in the park area (PARK-070)." },
  { label: "Read", ms: 2200, caption: "The latch reads NO. The node reads that one value. It does not simulate the losers." },
  { label: "Promote", ms: 2400, caption: "The match is sent. Inclusion requires seq 0 and moves the key to seq 1." },
  { label: "Consumed", ms: 3000, caption: "Seq 0 is gone, so YES and REFUND can never be valid again. That is the whole exclusion mechanism." },
];

const CHEQUES = [
  { id: "yes", name: "CET_YES", tag: "YES" },
  { id: "no", name: "CET_NO", tag: "NO" },
  { id: "ref", name: "CET_REFUND", tag: "EXPIRED" },
];

export function NonceSlot() {
  return (
    <Diagram fig="Fig. 5" title="One nonce slot, three signed values" steps={STEPS}>
      {(step, round) => (
        <LayoutGroup id={`ns-${round}`}>
          <div className="ns">
            <div className="ns__park">
              <span className="ns__cap">park area</span>
              {CHEQUES.map((c) => {
                const winner = c.id === "no";
                if (winner && step >= 2) return <div key={c.id} className="ns__ghost" />;
                const dead = !winner && step >= 3;
                return (
                  <motion.div key={c.id} layoutId={`ns-${c.id}-${round}`} className="ns__c" data-dead={dead} data-hot={winner && step === 1}>
                    <b>{c.name}</b>
                    <span>needs {c.tag}</span>
                    {dead && <motion.i className="ns__strike" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} />}
                  </motion.div>
                );
              })}
            </div>

            <div className="ns__mid">
              <div className="ns__latch" data-on={step >= 1}>
                latch <b>{step >= 1 ? "NO" : "UNSET"}</b>
              </div>
              <span className="ns__note">{step >= 1 ? "1 storage read · 0 simulations" : "watching one slot"}</span>
            </div>

            <div className="ns__slot">
              <span className="ns__cap">sender · key 1</span>
              <div className="ns__socket" data-filled={step >= 2}>
                {step >= 2 ? (
                  <motion.div layoutId={`ns-no-${round}`} className="ns__c" data-win transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}>
                    <b>CET_NO</b>
                    <span>landed</span>
                  </motion.div>
                ) : (
                  <span className="ns__empty">next valid: seq 0</span>
                )}
              </div>
              <div className="ns__seq">
                seq
                <motion.b key={step >= 2 ? 1 : 0} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                  {step >= 2 ? "1" : "0"}
                </motion.b>
              </div>
            </div>
          </div>
        </LayoutGroup>
      )}
    </Diagram>
  );
}
