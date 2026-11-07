"use client";

import { animate, motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";

export const EASE = [0.16, 1, 0.3, 1] as const;

const VIEW = { once: true, amount: 0.35 } as const;

/** Fade up out of a slight blur, once, when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "figure" | "p" | "li";
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y: 22, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={VIEW}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

/** Staggers its direct children into view. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={container}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      {Children.map(children, (child) => (
        <motion.div variants={item} className="stagger__item">
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

const lineParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const lineChild: Variants = {
  hidden: { y: "105%" },
  show: { y: "0%", transition: { duration: 1, ease: EASE } },
};

/** A heading whose lines rise out of a mask, the same gesture as the hero. The heading itself is observed. */
export function RevealHeading({
  lines,
  id,
  className,
  as = "h2",
}: {
  lines: ReactNode[];
  id?: string;
  className?: string;
  as?: "h1" | "h2";
}) {
  const reduce = useReducedMotion();
  const Tag = as === "h1" ? motion.h1 : motion.h2;
  return (
    <Tag
      id={id}
      className={className}
      variants={lineParent}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
    >
      {lines.map((l, i) => (
        <span className="line" key={i}>
          <motion.span variants={lineChild}>{l}</motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Counts up to `to` once it scrolls into view. Renders the final value for reduced motion and no-JS. */
export function CountUp({ to, duration = 1.6 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(to);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || reduce || started.current) return;
    started.current = true;
    const controls = animate(0, to, {
      duration,
      ease: EASE,
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, reduce, to, duration]);

  return (
    <span ref={ref} className="tnum">
      {value}
    </span>
  );
}
