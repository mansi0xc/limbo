"use client";

import { motion } from "motion/react";
import { Diagram } from "./Diagram";

/**
 * The deadman rescue on one time axis (not to scale):
 * pings push D forward, the owner goes silent, grace passes, anyone expires, the rescue lands,
 * and the rescue window bounds how long the funds stay reserved.
 */
const STEPS = [
  { label: "Pinging", ms: 3000, caption: "While the owner is around, each ping() moves the deadline to now + interval. The rescue waits, parked." },
  { label: "Silent", ms: 2400, caption: "The owner stops. D stops moving. Nobody has to notice yet." },
  { label: "Grace", ms: 2200, caption: "After D comes the grace period g. Nothing can settle the latch inside it." },
  { label: "Expire", ms: 2400, caption: "After D + g, anyone calls expire(). The latch reads EXPIRED, the park node promotes, and the beneficiary is paid." },
  { label: "Window", ms: 3200, caption: "Until the rescue lands, or until D + W, the balance is reserved. W = g + cheque expiry + margin, so the reservation outlives every parked copy." },
];

const X = { p1: 8, p2: 16, p3: 24, D: 38, Dg: 46, ex: 50, land: 54, E: 82, W: 90 };

export function DeadmanTimeline() {
  return (
    <Diagram fig="Fig. 6" title="Deadman rescue, on one time axis" steps={STEPS}>
      {(step) => {
        const D = step === 0 ? X.p3 + 10 : X.D;
        const cursor = [X.p3, X.D - 4, X.Dg - 1, X.land, X.W - 2][step];
        return (
          <div className="dt">
            <div className="dt__axis">
              <span className="dt__line" />
              {[X.p1, X.p2, X.p3].map((x, i) => (
                <span key={x} className="dt__ping" style={{ left: `${x}%` }} data-on={step === 0 || step > 0}>
                  ping {i + 1}
                </span>
              ))}

              <motion.span className="dt__mark dt__mark--D" animate={{ left: `${D}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}>
                D
              </motion.span>

              <motion.span
                className="dt__band dt__band--grace"
                animate={{ left: `${X.D}%`, width: `${X.Dg - X.D}%`, opacity: step >= 2 ? 1 : 0 }}
              >
                g
              </motion.span>

              <span className="dt__mark dt__mark--E" style={{ left: `${X.E}%` }}>
                cheque expiry E
              </span>

              <motion.span
                className="dt__band dt__band--window"
                animate={{ left: `${X.D}%`, width: `${X.W - X.D}%`, opacity: step >= 4 ? 1 : 0 }}
              >
                funds reserved until landed or D + W
              </motion.span>

              {step >= 3 && (
                <>
                  <motion.span className="dt__event" style={{ left: `${X.ex}%` }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    expire()
                  </motion.span>
                  <motion.span
                    className="dt__event dt__event--land"
                    style={{ left: `${X.land}%` }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    rescue lands
                  </motion.span>
                </>
              )}

              <motion.span className="dt__cursor" animate={{ left: `${cursor}%` }} transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1] }} />
            </div>
            <div className="dt__legend">
              <span>
                <i className="dt__sw dt__sw--g" /> grace g
              </span>
              <span>
                <i className="dt__sw dt__sw--w" /> rescue window W
              </span>
              <span className="dt__nts">time, not to scale</span>
            </div>
          </div>
        );
      }}
    </Diagram>
  );
}
