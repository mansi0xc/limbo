"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useState } from "react";
import { USE_CASES } from "@/lib/impact";
import { EASE } from "./Motion";

/**
 * Use cases as an index plus a detail sheet. Every case stays listed and readable at a glance;
 * selecting one shows who it serves and what changes, today against Limbo.
 */
export function UseCases() {
  const [active, setActive] = useState(USE_CASES[0].id);
  const c = USE_CASES.find((u) => u.id === active)!;

  return (
    <MotionConfig reducedMotion="user">
      <div className="uc">
        <ol className="uc__list" role="tablist" aria-label="Use cases">
          {USE_CASES.map((u) => (
            <li key={u.id}>
              <button
                role="tab"
                id={`uc-tab-${u.id}`}
                aria-selected={u.id === active}
                aria-controls="uc-panel"
                className="uc__item"
                onClick={() => setActive(u.id)}
                onMouseEnter={() => setActive(u.id)}
              >
                <span className="uc__title">{u.title}</span>
                <span className="uc__tag" data-status={u.status}>
                  {u.status === "demoed" ? "Built and demoed" : "Same rule"}
                </span>
                {u.id === active && <motion.span layoutId="uc-ink" className="uc__ink" transition={{ duration: 0.5, ease: EASE }} />}
              </button>
            </li>
          ))}
        </ol>

        <div className="uc__panel" id="uc-panel" role="tabpanel" aria-labelledby={`uc-tab-${c.id}`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <p className="uc__who">{c.who}</p>
              <div className="uc__cmp">
                <div className="uc__today">
                  <span>Today</span>
                  <p>{c.today}</p>
                </div>
                <div className="uc__limbo">
                  <span>With Limbo</span>
                  <p>{c.limbo}</p>
                </div>
              </div>
              <div className="uc__trigger">
                <span>Trigger</span>
                <b>{c.trigger}</b>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
