import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import Shader from "./Shader";
import { BlurWords, Magnetic, Reveal, cx, usePhases } from "./ui";
import { REPO_URL } from "../config";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 12);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        className={cx(
          "flex h-14 w-full max-w-[1120px] items-center gap-6 rounded-full border px-3 pl-5 transition-all duration-500",
          scrolled ? "border-line-2 bg-ink/70 shadow-[0_10px_40px_-20px_#000] backdrop-blur-xl" : "border-transparent bg-transparent"
        )}
      >
        <a href="#top" className="flex items-center gap-2.5" aria-label="Trellis home">
          <Logo />
          <span className="display-sm text-[19px] tracking-[-0.03em]">Trellis</span>
        </a>
        <div className="ml-auto hidden items-center gap-7 text-[14px] text-fg-2 md:flex">
          <a className="transition-colors hover:text-fg" href="#features">Features</a>
          <a className="transition-colors hover:text-fg" href="#how">How it works</a>
          <a className="transition-colors hover:text-fg" href="#compare">Why Trellis</a>
          <a className="transition-colors hover:text-fg" href="#spec">The rule</a>
        </div>
        <a
          href={REPO_URL}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-full border border-line-2 bg-white/[0.04] px-4 text-[14px] transition-colors hover:bg-white/[0.08] md:ml-0"
        >
          <GithubMark /> GitHub
        </a>
      </nav>
    </motion.header>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M16 3l13 13-13 13L3 16z" stroke="var(--color-wait)" strokeWidth="2" />
      <path d="M9.5 9.5l13 13M22.5 9.5l-13 13" stroke="var(--color-live)" strokeWidth="2" />
    </svg>
  );
}

export default function Hero() {
  return (
    <section id="top" className="relative isolate min-h-[100svh] overflow-hidden">
      <Shader className="absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-b from-transparent to-ink" />

      <div className="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-14 px-5 pb-20 pt-36 md:pt-44 lg:grid-cols-[1.15fr_.85fr] lg:pb-28">
        <div>
          <Reveal y={10}>
            <a href="#how" className="group inline-flex items-center gap-2.5 rounded-full border border-line-2 bg-white/[0.03] py-1.5 pl-1.5 pr-3.5 backdrop-blur-md">
              <span className="whitespace-nowrap rounded-full bg-live px-2 py-0.5 font-mono text-[10.5px] font-semibold tracking-wider text-ink">EIP-8141</span>
              <span className="shine text-[13px]"><span className="sm:hidden">A park area for the mempool</span><span className="hidden sm:inline">A park area for the frame-transaction mempool</span></span>
              <ArrowRight size={13} className="text-mute transition-transform group-hover:translate-x-0.5" />
            </a>
          </Reveal>

          <h1 className="display mt-8 text-[clamp(44px,6.4vw,84px)]">
            <BlurWords text={"Sign it today.\nIt lands the\nmoment it's *valid.*"} delay={0.15} />
          </h1>

          <Reveal delay={0.55}>
            <p className="mt-8 max-w-[540px] text-[18px] leading-[1.6] text-fg-2">
              Trellis holds pre-signed Ethereum transactions that aren't valid yet. When a write-once latch flips, it delivers
              the <span className="text-fg">exact bytes you signed</span>. No keeper builds the call, and no one can change it.
            </p>
          </Reveal>

          <Reveal delay={0.7}>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Magnetic href="#how">
                Watch it work <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Magnetic>
              <Magnetic href="#spec" variant="ghost">Read the rule</Magnetic>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.45} y={30}>
          <HeroCard />
        </Reveal>
      </div>

      <Proof />
    </section>
  );
}

/* A live-feeling parked transaction: parked, then the latch flips, then it lands. */
function HeroCard() {
  const ref = useRef<HTMLDivElement>(null);
  const [phase] = usePhases(4, [2600, 1500, 1700, 3600], ref);
  const reduce = useReducedMotion();
  const [secs, setSecs] = useState(9);
  useEffect(() => {
    if (phase !== 0) return;
    setSecs(reduce ? 0 : 3);
    if (reduce) return;
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 800);
    return () => clearInterval(id);
  }, [phase, reduce]);

  const flipped = phase >= 2;
  const landed = phase >= 3;
  const frames = [
    { mode: "VERIFY", fn: "expiry_verify", arg: "deadline", ok: phase >= 1 },
    { mode: "VERIFY", fn: "self_verify", arg: "latch == EXPIRED", ok: flipped },
    { mode: "SENDER", fn: "pay", arg: "beneficiary, 4.2 ETH", ok: landed },
  ];

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[440px]">
      <div className="absolute -inset-8 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,rgb(166_156_255/.18),transparent)] blur-2xl" />
      <motion.div
        animate={{ boxShadow: landed ? "0 0 0 1px rgb(197 244 103 / .45), 0 30px 80px -30px rgb(197 244 103 / .45)" : "0 0 0 1px rgb(166 156 255 / .28), 0 30px 80px -30px rgb(0 0 0 / .9)" }}
        transition={{ duration: 0.8 }}
        className="overflow-hidden rounded-[26px] bg-panel/85 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2 font-mono text-[12px] text-mute">
            <span className={cx("size-2 rounded-full", landed ? "bg-live" : "bg-wait")} />
            deadman-rescue.tx
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={landed ? "l" : flipped ? "f" : "p"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={cx(
                "rounded-full px-2.5 py-1 font-mono text-[11px]",
                landed ? "bg-live text-ink" : flipped ? "bg-live-soft text-live" : "bg-wait-soft text-wait"
              )}
            >
              {landed ? "LANDED" : flipped ? "VALID" : "PARKED"}
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="space-y-5 p-5">
          {/* latch */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-ink-2 px-4 py-3.5">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-mute">latch · owner heartbeat</div>
              <div className="mt-1.5 font-mono text-[13px] text-fg-2">
                {flipped ? "anyone called expire()" : `deadline + grace in 00:0${secs}`}
              </div>
            </div>
            <LatchSwitch on={flipped} labels={["UNSET", "EXPIRED"]} />
          </div>

          {/* frames */}
          <div>
            <div className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-mute">frames · signed 14 days ago</div>
            <div className="space-y-1.5">
              {frames.map((f, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.025] px-3 py-2.5 font-mono text-[12.5px]">
                  <span className="w-14 text-[10.5px] text-mute">{f.mode}</span>
                  <span className="text-fg">{f.fn}</span>
                  <span className="truncate text-mute">({f.arg})</span>
                  <motion.span
                    animate={{ backgroundColor: f.ok ? "#c5f467" : "rgba(255,255,255,.12)", scale: f.ok ? [1, 1.6, 1] : 1 }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    className="ml-auto size-2 shrink-0 rounded-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* footer */}
          <div className="relative h-[54px] overflow-hidden rounded-2xl border border-line">
            <AnimatePresence mode="wait">
              {landed ? (
                <motion.div key="landed" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -24, opacity: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 flex items-center justify-between bg-live-soft px-4 font-mono text-[12px] text-live">
                  <span>block #1,209,341 · idx 3</span>
                  <span className="text-fg-2">sig 0x9f…c2 unchanged</span>
                </motion.div>
              ) : (
                <motion.div key="wait" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -24, opacity: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 flex items-center justify-between px-4 font-mono text-[12px] text-mute">
                  <span>held by node A · node B</span>
                  <span>{flipped ? "promoting…" : "0 gas spent"}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function LatchSwitch({ on, labels, size = "md" }: { on: boolean; labels: [string, string]; size?: "md" | "lg" }) {
  const w = size === "lg" ? "w-[188px]" : "w-[150px]";
  return (
    <div className={cx("relative grid h-9 grid-cols-2 rounded-full border p-1 font-mono text-[10.5px] transition-colors duration-500", w, on ? "border-live/40" : "border-line-2")}>
      <motion.div
        className={cx("absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full", on ? "bg-live" : "bg-white/10")}
        animate={{ left: on ? "calc(50% + 0px)" : "4px" }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
      <span className={cx("relative z-10 grid place-items-center transition-colors", on ? "text-mute" : "text-fg")}>{labels[0]}</span>
      <span className={cx("relative z-10 grid place-items-center transition-colors", on ? "font-semibold text-ink" : "text-mute")}>{labels[1]}</span>
    </div>
  );
}

function Proof() {
  const items = ["EIP-8141 frame transactions", "ERC-8421 alt mempool", "EIP-8250 nonce keys", "write-once latch", "VERIFY-frame validity", "two independent park nodes", "stake-bounded quotas", "no simulation on eviction"];
  return (
    <div className="relative border-y border-line bg-ink/60 py-5 backdrop-blur-sm">
      <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <div className="marquee flex w-max gap-12 whitespace-nowrap font-mono text-[12.5px] text-mute">
          {[...items, ...items].map((t, i) => (
            <span key={i} className="flex items-center gap-12">
              {t}
              <span className="size-1 rotate-45 bg-dim" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function GithubMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
