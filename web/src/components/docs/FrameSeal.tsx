"use client";

import { AnimatePresence, motion } from "motion/react";
import { Diagram } from "./Diagram";

const STEPS = [
  { label: "Build", ms: 2400, caption: "The rescue is five frames. The trigger lives inside frame 1, so it is part of what gets signed." },
  { label: "Sign", ms: 2400, caption: "One signature hash covers every frame. The owner signs it once." },
  { label: "Verify", ms: 2200, caption: "A park node recomputes the hash from the bytes and recovers the owner. Nothing the submitter says is trusted." },
  { label: "Tamper", ms: 3000, caption: "Change one payout and the hash changes, so the signature recovers to a stranger. The node rejects it under PARK-030." },
];

const FRAMES = [
  { mode: "VERIFY", name: "expiry_verify", data: "E = D + 3600 s" },
  { mode: "VERIFY", name: "self_verify", data: "(latch, eventId, EXPIRED)", key: true },
  { mode: "SENDER", name: "markRescued()", data: "self-call · ≥ 25k gas" },
  { mode: "SENDER", name: "payout", data: "beneficiary ← 0.02 ETH", pay: true },
];

const HASH_OK = "0x9c4e…a1f3";
const HASH_BAD = "0x51d0…7e2b";

export function FrameSeal() {
  return (
    <Diagram fig="Fig. 3" title="One signature seals the whole transaction" steps={STEPS}>
      {(step) => {
        const tamper = step === 3;
        return (
          <div className="fs">
            <div className="fs__frames">
              {FRAMES.map((f, i) => (
                <motion.div
                  key={f.name}
                  className="fs__frame"
                  data-key={!!f.key}
                  data-bad={tamper && !!f.pay}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.12 }}
                >
                  <span className="fs__idx">{i}</span>
                  <span className="fs__mode">{f.mode}</span>
                  <span className="fs__name">{f.name}</span>
                  <span className="fs__data">
                    {f.pay && tamper ? (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        attacker ← 0.02 ETH
                      </motion.span>
                    ) : (
                      f.data
                    )}
                  </span>
                </motion.div>
              ))}
            </div>

            <div className="fs__brace" data-on={step >= 1} />

            <div className="fs__seal">
              <div className="fs__row">
                <span>signature hash</span>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.code
                    key={step < 1 ? "none" : tamper ? "bad" : "ok"}
                    data-bad={tamper}
                    initial={{ opacity: 0, filter: "blur(4px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0 }}
                  >
                    {step < 1 ? "—" : tamper ? HASH_BAD : HASH_OK}
                  </motion.code>
                </AnimatePresence>
              </div>
              <div className="fs__row">
                <span>recovers to</span>
                <code data-bad={tamper}>{step < 2 ? "—" : tamper ? "0x7a31… (stranger)" : "owner"}</code>
              </div>
              <div className="fs__verdict" data-state={step < 2 ? "idle" : tamper ? "bad" : "ok"}>
                {step < 2 ? "waiting" : tamper ? "rejected · PARK-030" : "admitted"}
              </div>
            </div>
          </div>
        );
      }}
    </Diagram>
  );
}
