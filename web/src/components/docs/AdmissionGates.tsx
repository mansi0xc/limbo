"use client";

import { motion } from "motion/react";
import { Diagram } from "./Diagram";

const GATES = [
  { id: "tpl", label: "Template", rule: "PARK-030" },
  { id: "trg", label: "Signed trigger", rule: "PARK-010" },
  { id: "exp", label: "Expiry", rule: "PARK-040" },
  { id: "sig", label: "Signatures", rule: "PARK-030" },
  { id: "dup", label: "Duplicate", rule: "PARK-050" },
  { id: "stk", label: "Latch + stake", rule: "PARK-010/020" },
  { id: "cap", label: "Caps P / E", rule: "PARK-050" },
];

/** Each run sends one cheque down the pipeline; `stop` is the gate that rejects it (or none). */
const RUNS = [
  { name: "rescue #1", stop: -1, why: "Passes every check and is parked. Trigger slots used: 1 of 4." },
  { name: "rescue #1 (again)", stop: 4, why: "Same bytes resubmitted, matched by transaction hash. Rejected and not counted, so replays cannot fill the caps." },
  { name: "edited trigger", stop: 1, why: "The trigger the submitter declared differs from the one inside the signed self_verify data." },
  { name: "rescue #5", stop: 6, why: "A fifth cheque on one trigger. With P = 4 it is rejected on arrival, not at the end of a batch." },
];

export function AdmissionGates() {
  const steps = RUNS.map((r) => ({ label: r.name, ms: 4200, caption: r.why }));
  return (
    <Diagram fig="Fig. 4" title="Admission: every check, in order, against the bytes alone" steps={steps}>
      {(step, round) => {
        const run = RUNS[step];
        const end = run.stop === -1 ? GATES.length : run.stop;
        const slots = step === 3 ? 4 : 1 + (step >= 3 ? 3 : 0);
        return (
          <div className="ag">
            <div className="ag__track">
              {GATES.map((g, i) => (
                <div key={g.id} className="ag__gate" data-state={i < end ? "pass" : i === end && run.stop !== -1 ? "stop" : "idle"}>
                  <span className="ag__label">{g.label}</span>
                  <span className="ag__rule">{g.rule}</span>
                </div>
              ))}
              <div className="ag__gate ag__gate--end" data-state={run.stop === -1 ? "pass" : "idle"}>
                <span className="ag__label">Parked</span>
                <span className="ag__rule">PARK-060</span>
              </div>
              <motion.div
                key={`${round}-${step}`}
                className="ag__cheque"
                data-bad={run.stop !== -1}
                initial={{ left: "0%" }}
                animate={{ left: `${((Math.min(end, GATES.length) + 0.5) / (GATES.length + 1)) * 100}%` }}
                transition={{ duration: 1.8, ease: [0.65, 0, 0.35, 1] }}
              >
                {run.name}
              </motion.div>
            </div>
            <div className="ag__slots" aria-label={`Trigger slots used: ${slots} of 4`}>
              <span>trigger slots</span>
              {[0, 1, 2, 3].map((i) => (
                <i key={i} data-on={i < slots} />
              ))}
              <span className="ag__slotnum tnum">{slots} / 4</span>
            </div>
          </div>
        );
      }}
    </Diagram>
  );
}
