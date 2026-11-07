"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

export type TocItem = { id: string; label: string; sub?: boolean };

/** Sticky contents rail with scroll-spy. On narrow screens it becomes a compact jump menu. */
export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    const onScroll = () => {
      const line = window.innerHeight * 0.28;
      let current = els[0]?.id;
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id;
      setActive(current);
      const doc = document.documentElement;
      setProgress(Math.min(1, window.scrollY / Math.max(1, doc.scrollHeight - window.innerHeight)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);

  return (
    <>
      <nav className="toc" aria-label="On this page">
        <div className="toc__head">
          <span>On this page</span>
          <span className="toc__pct tnum">{Math.round(progress * 100)}%</span>
        </div>
        <div className="toc__bar">
          <motion.span style={{ scaleX: progress }} />
        </div>
        <ol>
          {items.map((i) => (
            <li key={i.id} data-sub={!!i.sub}>
              <a href={`#${i.id}`} aria-current={active === i.id ? "location" : undefined}>
                {active === i.id && <motion.span layoutId="toc-dot" className="toc__dot" />}
                {i.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <label className="toc-mobile">
        <span className="sr-only">Jump to section</span>
        <select
          value={active}
          onChange={(e) => document.getElementById(e.target.value)?.scrollIntoView({ behavior: "smooth" })}
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sub ? "  " : ""}
              {i.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
