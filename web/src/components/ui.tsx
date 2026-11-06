import { motion, useInView, useMotionValue, useSpring, useReducedMotion } from "motion/react";
import { ReactNode, useRef, MouseEvent, useEffect, useState } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* Fade + rise when scrolled into view. Content is in the DOM from the start. */
export function Reveal({ children, delay = 0, className = "", y = 18 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* Word-by-word blur-in for headlines. Words marked with * render in the serif italic. */
export function BlurWords({ text, className = "", delay = 0, stagger = 0.06 }: { text: string; className?: string; delay?: number; stagger?: number }) {
  const reduce = useReducedMotion();
  const lines = text.split("\n");
  let i = 0;
  return (
    <span className={className}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split(" ").map((w, wi) => {
            const serif = w.startsWith("*");
            const word = serif ? w.replace(/\*/g, "") : w;
            const d = delay + i++ * stagger;
            return (
              <motion.span
                key={wi}
                className={cx("inline-block will-change-transform", serif && "serif-i text-live")}
                style={serif ? { fontSize: "1.08em", letterSpacing: "-0.02em" } : undefined}
                initial={reduce ? false : { opacity: 0, y: "0.35em", filter: "blur(12px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: d, ease: [0.16, 1, 0.3, 1] }}
              >
                {word}
                {wi < line.split(" ").length - 1 ? " " : ""}
              </motion.span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

/* Button that leans toward the cursor. */
export function Magnetic({ children, href, variant = "solid", className = "" }: { children: ReactNode; href: string; variant?: "solid" | "ghost"; className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  const move = (e: MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * 0.22);
    y.set((e.clientY - r.top - r.height / 2) * 0.3);
  };
  const leave = () => { x.set(0); y.set(0); };
  return (
    <motion.a
      ref={ref}
      href={href}
      onMouseMove={move}
      onMouseLeave={leave}
      style={{ x, y }}
      className={cx(
        "group relative inline-flex h-12 items-center gap-2.5 rounded-full px-6 text-[15px] font-medium transition-colors",
        variant === "solid"
          ? "bg-live text-ink shadow-[0_0_0_1px_rgb(197_244_103/.5),0_10px_40px_-10px_rgb(197_244_103/.6)] hover:bg-[#d4ff7a]"
          : "border border-line-2 bg-white/[0.03] text-fg backdrop-blur-md hover:border-white/30 hover:bg-white/[0.06]",
        className
      )}
    >
      {children}
    </motion.a>
  );
}

/* Card with a soft spotlight that follows the cursor. */
export function Spotlight({ children, className = "", color = "rgb(166 156 255 / .14)" }: { children: ReactNode; className?: string; color?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    ref.current!.style.setProperty("--mx", `${e.clientX - r.left}px`);
    ref.current!.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div
      ref={ref}
      onMouseMove={move}
      className={cx("ring-grad group relative overflow-hidden rounded-3xl bg-panel/80", className)}
      style={{ ["--sc" as any]: color }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(420px circle at var(--mx) var(--my), var(--sc), transparent 60%)" }}
      />
      {children}
    </div>
  );
}

export function Tag({ children, tone = "mute" }: { children: ReactNode; tone?: "mute" | "wait" | "live" | "bad" }) {
  const tones = {
    mute: "border-line-2 text-fg-2 bg-white/[0.03]",
    wait: "border-wait/30 text-wait bg-wait-soft",
    live: "border-live/30 text-live bg-live-soft",
    bad: "border-bad/30 text-bad bg-bad-soft",
  };
  return <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] tracking-wide", tones[tone])}>{children}</span>;
}

/* Runs a phase index 0..n-1 on a timer while the element is on screen. */
export function usePhases(n: number, ms: number | number[], ref: React.RefObject<Element | null>, opts: { paused?: boolean } = {}) {
  const inView = useInView(ref, { amount: 0.35 });
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(reduce ? n - 1 : 0);
  useEffect(() => {
    if (!inView || reduce || opts.paused) return;
    const d = Array.isArray(ms) ? ms[phase] ?? 3000 : ms;
    const id = setTimeout(() => setPhase((p) => (p + 1) % n), d);
    return () => clearTimeout(id);
  }, [phase, inView, reduce, opts.paused, n]);
  return [phase, setPhase, inView] as const;
}

export function SectionHead({ eyebrow, title, sub, center = false }: { eyebrow: string; title: string; sub?: ReactNode; center?: boolean }) {
  return (
    <div className={cx("max-w-3xl", center && "mx-auto text-center")}>
      <Reveal>
        <div className={cx("eyebrow flex items-center gap-3", center && "justify-center")}>
          <span className="h-px w-6 bg-mute/60" />
          {eyebrow}
        </div>
      </Reveal>
      <h2 className="display-sm mt-5 text-[clamp(34px,4.6vw,60px)] text-fg">
        <BlurWords text={title} stagger={0.045} />
      </h2>
      {sub && (
        <Reveal delay={0.15}>
          <p className={cx("mt-5 max-w-2xl text-[17px] leading-relaxed text-fg-2", center && "mx-auto")}>{sub}</p>
        </Reveal>
      )}
    </div>
  );
}
