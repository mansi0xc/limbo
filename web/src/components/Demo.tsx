import { motion, AnimatePresence, LayoutGroup, useReducedMotion, animate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, X, Check, Zap } from "lucide-react";
import { Reveal, SectionHead, cx, usePhases } from "./ui";
import { LatchSwitch } from "./Hero";

type Scenario = "deadman" | "bet";

const STEPS: Record<Scenario, { t: string; d: string }[]> = {
  deadman: [
    { t: "Sign the rescue", d: "The owner signs one transaction that pays a beneficiary. It's only valid once the owner's heartbeat latch reads EXPIRED, so right now it's invalid." },
    { t: "Rejected at the head, parked", d: "The public mempool checks against the current head and turns it away. Two park nodes admit the same signed bytes instead. Nothing goes on-chain, and no gas is spent." },
    { t: "The owner goes quiet", d: "The owner pinged the latch for months. Then the pings stop. The deadline plus grace period runs out." },
    { t: "Anyone calls expire()", d: "Any account can poke the latch once the deadline has passed. It flips from UNSET to EXPIRED, and it can never flip back." },
    { t: "Delivered, byte for byte", d: "The park node forwards the rescue exactly as it was signed. The VERIFY frame now passes, the beneficiary is paid, and the owner was never online." },
  ],
  bet: [
    { t: "Pre-sign every outcome", d: "Three pairs bet on the same event. Each pair signs a YES, a NO and a REFUND payout on one shared nonce key, so only one of the three can ever land." },
    { t: "Park all nine", d: "None of them is valid yet, so the public mempool rejects them. The park area holds all nine side by side, indexed by the event they wait for." },
    { t: "One attestation", d: "The oracle attests YES once. The event's latch flips, and every cheque waiting on YES becomes valid in the same instant." },
    { t: "Every winner lands", d: "One attestation, three payouts. The park node forwards every YES cheque in the next block, each with its own signature, untouched." },
    { t: "Losers never become transactions", d: "NO and REFUND share the winner's nonce key, so they can never be valid again. They're dropped by key with no simulation, and they never reach a block or pay gas." },
  ],
};

const DUR = [3600, 3800, 3400, 3200, 4600];

export default function Demo() {
  const [sc, setSc] = useState<Scenario>("deadman");
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = usePhases(5, DUR, ref, { paused });
  const reduce = useReducedMotion();

  const choose = (s: Scenario) => { setSc(s); setPhase(reduce ? 4 : 0); };
  const go = (i: number) => { setPhase(i); setPaused(true); };

  return (
    <section id="how" className="relative mx-auto max-w-[1120px] scroll-mt-24 px-5 pt-32 md:pt-44">
      <SectionHead
        eyebrow="How it works"
        title={"Watch a transaction\nwait for its *moment.*"}
        sub="Two real workloads from the Trellis repo. A deadman rescue that lands with nobody online, and a bet where one attestation settles every payout."
      />

      <Reveal delay={0.1}>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex rounded-full border border-line-2 bg-white/[0.03] p-1" role="tablist">
            {(["deadman", "bet"] as Scenario[]).map((s) => (
              <button key={s} role="tab" aria-selected={sc === s} onClick={() => choose(s)}
                className={cx("relative rounded-full px-5 py-2 text-[14px] transition-colors", sc === s ? "text-ink" : "text-fg-2 hover:text-fg")}>
                {sc === s && <motion.span layoutId="tabpill" className="absolute inset-0 rounded-full bg-fg" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                <span className="relative">{s === "deadman" ? "Deadman rescue" : "The bet"}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setPaused((p) => !p)} className="inline-flex h-10 items-center gap-2 rounded-full border border-line-2 px-4 font-mono text-[12px] text-fg-2 hover:text-fg">
            {paused ? <Play size={13} /> : <Pause size={13} />} {paused ? "play" : "pause"}
          </button>
        </div>
      </Reveal>

      <Reveal delay={0.15}>
        <div ref={ref} className="ring-grad mt-5 flex flex-col overflow-hidden rounded-[30px] bg-panel/70 shadow-[0_40px_120px_-40px_rgb(0_0_0/.9)]">
          {/* stepper */}
          <div className="order-0 grid grid-cols-5 border-b border-line">
            {STEPS[sc].map((s, i) => (
              <button key={i} onClick={() => go(i)} className="group relative px-3 py-4 text-left md:px-5">
                <div className={cx("font-mono text-[11px] transition-colors", i === phase ? "text-live" : i < phase ? "text-fg-2" : "text-dim")}>0{i + 1}</div>
                <div className={cx("mt-1 hidden truncate text-[13px] transition-colors md:block", i === phase ? "text-fg" : "text-mute group-hover:text-fg-2")}>{s.t}</div>
                <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.04]">
                  {i < phase && <div className="h-full w-full bg-live/40" />}
                  {i === phase && (
                    <motion.div key={`${sc}-${phase}-${paused}`} className="h-full bg-live" initial={{ width: paused || reduce ? "100%" : "0%" }} animate={{ width: "100%" }} transition={{ duration: paused || reduce ? 0 : DUR[i] / 1000, ease: "linear" }} />
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="order-2">
          <LayoutGroup id={sc}>
            {sc === "deadman" ? <Deadman phase={phase} /> : <Bet phase={phase} />}
          </LayoutGroup>
          </div>

          {/* caption */}
          <div className="relative order-1 min-h-[150px] border-b border-line px-5 py-5 md:order-3 md:min-h-[132px] md:border-b-0 md:border-t md:px-8 md:py-6">
            <AnimatePresence mode="wait">
              <motion.div key={sc + phase} initial={{ opacity: 0, y: 10, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(6px)" }} transition={{ duration: 0.45 }}
                className="grid gap-2 md:grid-cols-[280px_1fr] md:gap-10">
                <div className="display-sm text-[22px] text-fg"><span className="mr-2 font-mono text-[13px] text-live">0{phase + 1}</span>{STEPS[sc][phase].t}</div>
                <p className="max-w-[640px] text-[15.5px] leading-relaxed text-fg-2">{STEPS[sc][phase].d}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------- shared stage pieces ---------- */

const layoutT = { type: "spring", stiffness: 140, damping: 22, mass: 0.9 } as const;

type CState = "draft" | "parked" | "valid" | "landed" | "dead";
function Cheque({ id, label, sub, state, small = false }: { id: string; label: string; sub?: string; state: CState; small?: boolean }) {
  const styles: Record<CState, string> = {
    draft: "border-white/25 bg-white/[0.05] text-fg",
    parked: "border-dashed border-wait/60 bg-wait-soft text-wait",
    valid: "border-live/70 bg-live-soft text-live",
    landed: "border-live bg-live text-ink",
    dead: "border-dashed border-bad/40 bg-transparent text-bad/70 line-through",
  };
  return (
    <motion.div layout layoutId={id} transition={layoutT}
      exit={{ opacity: 0, scale: 0.6, filter: "blur(8px)", transition: { duration: 0.7 } }}
      className={cx("relative rounded-xl border font-mono transition-colors duration-500", small ? "px-2 py-1.5 text-[11px]" : "px-3 py-2.5 text-[12px]", styles[state])}>
      <motion.div layout="position" className="flex items-center gap-1.5 whitespace-nowrap">
        {state === "landed" && <Check size={12} />}
        {label}
      </motion.div>
      {sub && <motion.div layout="position" className={cx("mt-0.5 whitespace-nowrap text-[10.5px]", state === "landed" ? "text-ink/70" : "opacity-70")}>{sub}</motion.div>}
    </motion.div>
  );
}

function ColHead({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-mute">
      <span>{children}</span>
      {right}
    </div>
  );
}

function Gate({ rejecting, label }: { rejecting: boolean; label: string }) {
  return (
    <div className={cx("flex items-center justify-between rounded-xl border px-3 py-2.5 font-mono text-[11.5px] transition-colors duration-300", rejecting ? "border-bad/40 bg-bad-soft" : "border-line bg-white/[0.02]")}>
      <span className="text-mute">public mempool · check at head</span>
      <AnimatePresence mode="wait">
        {rejecting ? (
          <motion.span key="x" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-bad"><X size={12} />{label}</motion.span>
        ) : (
          <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-dim">idle</motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function Node({ name, children, live = true }: { name: string; children?: React.ReactNode; live?: boolean }) {
  return (
    <div className="min-h-[92px] rounded-2xl border border-line bg-ink-2/70 p-3">
      <div className="mb-2.5 flex items-center gap-1.5 font-mono text-[11px] text-fg-2">
        <span className={cx("size-1.5 rounded-full", live ? "bg-live" : "bg-dim")} />{name}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Block({ n, active, children }: { n: number; active?: boolean; children?: React.ReactNode }) {
  return (
    <div className={cx("rounded-2xl border p-3 transition-colors duration-500", active ? "border-live/40 bg-live-soft/40" : "border-line bg-ink-2/60")}>
      <div className="mb-2 flex justify-between font-mono text-[11px] text-mute"><span>block #{n.toLocaleString()}</span>{active && <span className="text-live">new</span>}</div>
      <div className="flex flex-col gap-1.5">
        {children}
        <div className="h-[22px] rounded-lg bg-white/[0.04]" />
      </div>
    </div>
  );
}

function SysTx({ label, by }: { label: string; by: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={layoutT}
      className="flex items-center justify-between rounded-lg border border-line-2 bg-white/[0.05] px-2.5 py-1.5 font-mono text-[11px] text-fg">
      <span className="flex items-center gap-1.5"><Zap size={11} className="text-wait" />{label}</span><span className="text-mute">{by}</span>
    </motion.div>
  );
}

function Counter({ to, run }: { to: number; run: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current!;
    if (!run) { el.textContent = "0.00"; return; }
    const c = animate(0, to, { duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => (el.textContent = v.toFixed(2)) });
    return () => c.stop();
  }, [run, to]);
  return <span ref={ref}>0.00</span>;
}

function Heartbeat({ alive }: { alive: boolean }) {
  return (
    <svg viewBox="0 0 160 36" className="h-9 w-full" fill="none">
      {alive ? (
        <motion.path key="a" d="M0 18h40l6-12 8 24 6-16 4 4h36l6-12 8 24 6-16 4 4h36" stroke="var(--color-live)" strokeWidth="1.6" strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0.3 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }} />
      ) : (
        <motion.path key="d" d="M0 18h160" stroke="var(--color-bad)" strokeWidth="1.6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
      )}
    </svg>
  );
}

/* ---------- Deadman ---------- */

function Deadman({ phase }: { phase: number }) {
  const c = { id: "rescue", label: "RESCUE → beneficiary", sub: "4.2 ETH · sig 0x9f…c2" };
  const state: CState = phase === 0 ? "draft" : phase <= 2 ? "parked" : phase === 3 ? "valid" : "landed";
  return (
    <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.35fr_1fr] md:gap-5 md:p-6">
      {/* signers */}
      <div className="space-y-3">
        <ColHead>people</ColHead>
        <div className="rounded-2xl border border-line bg-ink-2/70 p-3">
          <div className="flex items-center justify-between font-mono text-[11.5px]">
            <span className="text-fg">owner</span>
            <span className={phase >= 2 ? "text-bad" : "text-live"}>{phase >= 2 ? "silent" : "pinging"}</span>
          </div>
          <Heartbeat alive={phase < 2} />
          <div className="min-h-[52px]">{phase === 0 && <Cheque id={c.id} label={c.label} sub={c.sub} state={state} />}</div>
        </div>
        <div className="rounded-2xl border border-line bg-ink-2/70 p-3 font-mono text-[11.5px]">
          <div className="flex justify-between"><span className="text-fg">beneficiary</span><span className="text-mute">offline too</span></div>
          <div className={cx("mt-2 text-[22px] tracking-tight transition-colors", phase === 4 ? "text-live" : "text-fg-2")}>
            + <Counter to={4.2} run={phase === 4} /> <span className="text-[12px] text-mute">ETH</span>
          </div>
        </div>
      </div>

      {/* park */}
      <div className="space-y-3">
        <ColHead right={<span className="text-wait">no gas while parked</span>}>park area</ColHead>
        <Gate rejecting={phase === 1} label="latch UNSET" />
        <div className="flex items-center justify-between rounded-2xl border border-line bg-ink-2/70 px-4 py-3">
          <div className="font-mono text-[11px] text-mute">
            heartbeat latch
            <div className="mt-1 text-[12px] text-fg-2">{phase < 2 ? "last ping 2 h ago" : phase === 2 ? "grace running out…" : "expired, for good"}</div>
          </div>
          <LatchSwitch on={phase >= 3} labels={["UNSET", "EXPIRED"]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Node name="node A">{phase >= 1 && phase <= 3 && <Cheque id={c.id} label="RESCUE" sub="0x9f…c2" state={state} small />}</Node>
          <Node name="node B">
            {phase >= 1 && phase <= 3 && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}>
                <div className={cx("rounded-xl border px-2 py-1.5 font-mono text-[11px] transition-colors", phase === 3 ? "border-live/70 bg-live-soft text-live" : "border-dashed border-wait/60 bg-wait-soft text-wait")}>
                  RESCUE<div className="text-[10.5px] opacity-70">0x9f…c2</div>
                </div>
              </motion.div>
            )}
            {phase === 4 && <span className="font-mono text-[10.5px] text-mute">backup copy, no longer needed</span>}
          </Node>
        </div>
      </div>

      {/* chain */}
      <div className="space-y-3">
        <ColHead>chain</ColHead>
        <Block n={1209339} />
        <Block n={1209340} active={phase === 3}>{phase >= 3 && <SysTx label="latch.expire()" by="anyone" />}</Block>
        <Block n={1209341} active={phase === 4}>{phase === 4 && <Cheque id={c.id} label={c.label} sub="same bytes · idx 3" state="landed" />}</Block>
      </div>
    </div>
  );
}

/* ---------- Bet ---------- */

const PAIRS = ["Alice · Bob", "Carol · Dan", "Eve · Finn"];
const OUTS = ["YES", "NO", "REFUND"];

function Bet({ phase }: { phase: number }) {
  const st = (o: string): CState => {
    if (phase === 0) return "draft";
    if (phase === 1) return "parked";
    if (o === "YES") return phase >= 3 ? "landed" : "valid";
    return phase >= 3 ? "dead" : "parked";
  };
  return (
    <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.35fr_1fr] md:gap-5 md:p-6">
      {/* signers */}
      <div className="space-y-3">
        <ColHead>people</ColHead>
        {PAIRS.map((p, pi) => (
          <div key={p} className="rounded-2xl border border-line bg-ink-2/70 p-3">
            <div className="mb-2 flex justify-between font-mono text-[11px]"><span className="text-fg">{p}</span><span className="text-mute">key 0x{(0xa7 + pi * 17).toString(16)}</span></div>
            <div className="flex min-h-[30px] flex-wrap gap-1.5">
              {phase === 0 && OUTS.map((o) => <Cheque key={o} id={`${pi}-${o}`} label={o} state="draft" small />)}
            </div>
          </div>
        ))}
        <div className={cx("rounded-2xl border p-3 font-mono text-[11px] transition-colors duration-500", phase === 2 ? "border-wait/50 bg-wait-soft" : "border-line bg-ink-2/70")}>
          <div className="flex justify-between"><span className="text-fg">oracle</span><span className={phase >= 2 ? "text-wait" : "text-mute"}>{phase >= 2 ? "signed YES" : "waiting"}</span></div>
        </div>
      </div>

      {/* park */}
      <div className="space-y-3">
        <ColHead right={<span className="text-wait">event #7 · ETH ≥ 4k on 1 Dec</span>}>park area</ColHead>
        <Gate rejecting={phase === 1} label="latch UNSET ×9" />
        <div className="flex items-center justify-between rounded-2xl border border-line bg-ink-2/70 px-4 py-3">
          <div className="font-mono text-[11px] text-mute">event latch<div className="mt-1 text-[12px] text-fg-2">{phase < 2 ? "waiting on the oracle" : "one attestation, settled"}</div></div>
          <LatchSwitch on={phase >= 2} labels={["UNSET", "YES"]} />
        </div>
        <div className="rounded-2xl border border-line bg-ink-2/70 p-3">
          <div className="mb-2.5 flex items-center gap-1.5 font-mono text-[11px] text-fg-2"><span className="size-1.5 rounded-full bg-live" />node A · indexed by (latch, event, tag)</div>
          <div className="grid min-h-[118px] gap-1.5">
            {phase >= 1 && PAIRS.map((p, pi) => (
              <div key={p} className="flex flex-wrap gap-1.5">
                <AnimatePresence>
                  {OUTS.map((o) => {
                    if (o === "YES" && phase >= 3) return null;
                    if (o !== "YES" && phase >= 4) return null;
                    return <Cheque key={o} id={`${pi}-${o}`} label={o} state={st(o)} small />;
                  })}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* chain */}
      <div className="space-y-3">
        <ColHead>chain</ColHead>
        <Block n={1209339} />
        <Block n={1209340} active={phase === 2}>{phase >= 2 && <SysTx label="latch.attest(YES)" by="oracle" />}</Block>
        <Block n={1209341} active={phase >= 3}>
          {phase >= 3 && PAIRS.map((p, pi) => <Cheque key={p} id={`${pi}-YES`} label={`YES · ${p.split(" · ")[0]}`} state="landed" small />)}
        </Block>
        <AnimatePresence>
          {phase === 4 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-dashed border-line-2 px-3 py-2.5 font-mono text-[11px] text-mute">
              6 losing cheques · 0 blocks · 0 gas
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
