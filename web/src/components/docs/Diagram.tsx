"use client";

import { AnimatePresence, motion, MotionConfig, useInView } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EASE } from "../Motion";

/** Steps through `durations` (ms) on a loop while the diagram is on screen. */
export function useStepper(durations: number[], active: boolean) {
  const [step, setStep] = useState(0);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => {
      if (step === durations.length - 1) {
        setStep(0);
        setRound((r) => r + 1);
      } else setStep(step + 1);
    }, durations[step]);
    return () => clearTimeout(t);
  }, [step, active, durations]);
  return { step, round, go: setStep };
}

/**
 * A numbered figure with a step rail and live caption.
 * `children` receives the current step and round; the rail lets a reader jump to any step.
 */
export function Diagram({
  fig,
  title,
  steps,
  children,
  className,
}: {
  fig: string;
  title: string;
  steps: { label: string; ms: number; caption: ReactNode }[];
  children: (step: number, round: number) => ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const durations = steps.map((s) => s.ms);
  const { step, round, go } = useStepper(durations, inView);

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.7, ease: EASE }}>
      <figure ref={ref} className={`dg ${className ?? ""}`}>
        <div className="dg__top">
          <span className="dg__fig">{fig}</span>
          <span className="dg__title">{title}</span>
        </div>
        <div className="dg__stage">{children(step, round)}</div>
        <div className="dg__rail">
          <ol className="steps" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
            {steps.map((s, i) => (
              <li key={s.label} data-state={i < step ? "done" : i === step ? "now" : "next"}>
                <button type="button" className="step" onClick={() => go(i)} aria-current={i === step ? "step" : undefined}>
                  <span className="step__bar">
                    {i === step && (
                      <motion.span
                        key={`${round}-${step}`}
                        className="step__fill"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: inView ? 1 : 0 }}
                        transition={{ duration: s.ms / 1000, ease: "linear" }}
                      />
                    )}
                  </span>
                  <span className="step__label">{s.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={step}
              className="dg__caption"
              aria-live="polite"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              {steps[step].caption}
            </motion.p>
          </AnimatePresence>
        </div>
      </figure>
    </MotionConfig>
  );
}
