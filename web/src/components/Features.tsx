import { motion, AnimatePresence } from "motion/react";
import { useRef } from "react";
import { Lock, X, Check } from "lucide-react";
import { Reveal, SectionHead, Spotlight, cx, usePhases } from "./ui";
import { LatchSwitch } from "./Hero";

export default function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-[1120px] scroll-mt-24 px-5 pt-32 md:pt-40">
      <SectionHead
        eyebrow="What it does"
        title={"Six properties.\nOne *primitive.*"}
        sub="EIP-8141 can make a transaction stop being valid after a deadline. Nothing let the public mempool hold one that becomes valid after an event. Trellis is that missing half."
      />

      <div className="mt-16 grid gap-4 md:grid-cols-3">
        <Reveal className="md:col-span-2"><Card title="Park what isn't valid yet" body="The public mempool checks every transaction against the current head and turns away anything that fails. Trellis catches those and holds them in a park area, separate from the live pool." visual={<ParkVisual />} /></Reveal>
        <Reveal delay={0.08}><Card title="A latch that flips once" body="One storage slot decides. It moves from unset to set exactly once and never back, so parking can only ever turn transactions valid." visual={<LatchVisual />} /></Reveal>
        <Reveal><Card title="Every outcome, pre-signed" body="Sign YES, NO and REFUND on one nonce key. Only one can ever land. The rest are dropped by key, with no simulation." visual={<SiblingVisual />} /></Reveal>
        <Reveal delay={0.08}><Card title="Same bytes, whoever delivers" body="Independent park nodes hold your signed bytes and revalidate them on their own. Whoever lands it, nobody can change a byte." visual={<NodesVisual />} /></Reveal>
        <Reveal delay={0.16}><Card title="Bounded under flood" body="Cheapest checks first, then quotas per sender and per latch, sized by stake. A flip touches only its own siblings." visual={<QuotaVisual />} /></Reveal>
        <Reveal className="md:col-span-3"><Card wide title="Checked on-chain, not by a bot" body="The condition lives in a VERIFY frame, so consensus enforces it. Until the latch flips, the transaction is invalid and can't be included. The node only decides when to forward it." visual={<FramesVisual />} /></Reveal>
      </div>
    </section>
  );
}

function Card({ title, body, visual, wide = false }: { title: string; body: string; visual: React.ReactNode; wide?: boolean }) {
  return (
    <Spotlight className={cx("h-full", wide ? "grid gap-6 p-7 md:grid-cols-[.8fr_1.2fr] md:items-center md:p-9" : "flex flex-col p-7")}>
      <div className={cx("relative", !wide && "order-2 mt-6")}>
        <h3 className="display-sm text-[22px] text-fg">{title}</h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-fg-2">{body}</p>
      </div>
      <div className={cx("relative flex min-h-[170px] items-center justify-center rounded-2xl border border-line bg-ink-2/80", !wide && "order-1")}>{visual}</div>
    </Spotlight>
  );
}

const spring = { type: "spring", stiffness: 260, damping: 26 } as const;

function ParkVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const [p] = usePhases(4, [900, 1100, 1400, 1600], ref);
  return (
    <div ref={ref} className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-6 font-mono text-[11.5px]">
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-mute">public mempool</div>
        <div className="relative h-[86px] rounded-xl border border-line bg-white/[0.02] p-2">
          <div className="h-5 rounded-md bg-white/[0.06]" />
          <div className="mt-1.5 h-5 w-4/5 rounded-md bg-white/[0.06]" />
          <AnimatePresence>
            {p === 1 && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 40 }} transition={spring}
                className="absolute inset-x-2 bottom-2 flex items-center gap-1.5 rounded-md border border-bad/40 bg-bad-soft px-2 py-1 text-bad">
                <X size={11} /> invalid at head
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <motion.svg width="38" height="12" viewBox="0 0 38 12" className="text-wait" animate={{ opacity: p >= 2 ? 1 : 0.25 }}>
        <path d="M0 6h34M29 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
      </motion.svg>
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-wait">park area</div>
        <div className="h-[86px] space-y-1.5 rounded-xl border border-wait/25 bg-wait-soft/40 p-2">
          <div className="rounded-md border border-dashed border-wait/40 px-2 py-1 text-wait/80">rescue · 0x3f…</div>
          <AnimatePresence>
            {p >= 2 && (
              <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={spring}
                className="rounded-md border border-dashed border-wait px-2 py-1 text-wait">cheque · 0x9f…</motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function LatchVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const [p] = usePhases(3, [1400, 2600, 600], ref);
  return (
    <div ref={ref} className="flex flex-col items-center gap-4">
      <motion.div animate={{ opacity: p === 2 ? 0 : 1 }} transition={{ duration: 0.4 }}>
        <LatchSwitch on={p === 1} labels={["UNSET", "SET · YES"]} size="lg" />
      </motion.div>
      <motion.div animate={{ opacity: p === 1 ? 1 : 0, y: p === 1 ? 0 : 6 }} className="flex items-center gap-1.5 font-mono text-[11px] text-live">
        <Lock size={11} /> write-once · can't unset
      </motion.div>
    </div>
  );
}

function SiblingVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const [p] = usePhases(3, [1500, 2400, 700], ref);
  const items = ["YES", "NO", "REFUND"];
  return (
    <div ref={ref} className="flex flex-col items-center gap-3 font-mono text-[11.5px]">
      <div className="text-[10px] uppercase tracking-[0.14em] text-mute">nonce key 0xa7 · seq 0</div>
      <div className="flex gap-2">
        {items.map((s, i) => {
          const win = i === 0 && p === 1;
          const gone = i > 0 && p === 1;
          return (
            <motion.div key={s}
              animate={{ opacity: p === 2 ? 0 : gone ? 0.18 : 1, scale: gone ? 0.9 : win ? 1.06 : 1, filter: gone ? "blur(2px)" : "blur(0px)" }}
              transition={spring}
              className={cx("rounded-lg border px-3 py-2", win ? "border-live bg-live text-ink" : "border-dashed border-wait/50 text-wait")}>
              {s}
            </motion.div>
          );
        })}
      </div>
      <motion.div animate={{ opacity: p === 1 ? 1 : 0 }} className="text-[11px] text-mute">one lands · two never exist</motion.div>
    </div>
  );
}

function NodesVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const [p] = usePhases(3, [1200, 2400, 600], ref);
  return (
    <div ref={ref} className="grid w-full grid-cols-2 gap-3 px-6 font-mono text-[11.5px]">
      {["node A", "node B"].map((n, i) => (
        <motion.div key={n} animate={{ opacity: p === 2 ? 0.4 : 1 }} className="rounded-xl border border-line bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-fg-2"><span className="size-1.5 rounded-full bg-live" />{n}</div>
          <div className="mt-2.5 rounded-md border border-dashed border-wait/40 px-2 py-1 text-wait">0x9f…c2</div>
          <motion.div initial={false} animate={{ opacity: p >= 1 ? 1 : 0, y: p >= 1 ? 0 : 4 }} transition={{ delay: i * 0.15 }} className="mt-2 flex items-center gap-1 text-[10.5px] text-live">
            <Check size={11} /> revalidated
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

function QuotaVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const [p] = usePhases(4, [700, 900, 1700, 700], ref);
  const fill = [0.25, 0.7, 1, 0][p];
  return (
    <div ref={ref} className="w-full space-y-3 px-6 font-mono text-[11px]">
      {[["per sender", 1], ["per latch", 0.6]].map(([l, k]) => (
        <div key={l as string}>
          <div className="mb-1.5 flex justify-between text-mute"><span>{l}</span><span>{Math.round(fill * (k as number) * 64)}/64</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div className="h-full rounded-full bg-wait" animate={{ width: `${fill * (k as number) * 100}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
          </div>
        </div>
      ))}
      <motion.div animate={{ opacity: p === 2 ? 1 : 0, x: p === 2 ? 0 : -6 }} className="flex items-center gap-1.5 text-bad"><X size={11} /> entry 65 rejected, no state read</motion.div>
    </div>
  );
}

function FramesVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const [p] = usePhases(4, [1100, 1100, 1100, 2200], ref);
  const frames = [
    { m: "VERIFY", f: "expiry_verify", a: "deadline" },
    { m: "VERIFY", f: "self_verify", a: "latch, event, tag" },
    { m: "SENDER", f: "pay", a: "winner" },
    { m: "SENDER", f: "pay", a: "fee" },
  ];
  return (
    <div ref={ref} className="grid w-full grid-cols-2 gap-2 p-4 font-mono sm:grid-cols-4">
      {frames.map((x, i) => (
        <motion.div key={i}
          animate={{ borderColor: p > i || p === 3 ? (x.m === "VERIFY" ? "rgb(197 244 103 / .5)" : "rgb(255 255 255 / .14)") : "rgb(255 255 255 / .06)", backgroundColor: p === i ? "rgb(255 255 255 / .04)" : "rgb(255 255 255 / 0)" }}
          className="rounded-xl border p-3">
          <div className="text-[10px] text-mute">frame {i}</div>
          <div className={cx("mt-2 inline-block rounded px-1.5 py-0.5 text-[9.5px] tracking-wider", x.m === "VERIFY" ? "bg-live-soft text-live" : "bg-white/[0.06] text-fg-2")}>{x.m}</div>
          <div className="mt-2 text-[12.5px] text-fg">{x.f}</div>
          <div className="truncate text-[11px] text-mute">({x.a})</div>
        </motion.div>
      ))}
    </div>
  );
}
