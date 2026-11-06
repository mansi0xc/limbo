import { motion, AnimatePresence } from "motion/react";
import { useRef, useState } from "react";
import { Bot, FileSignature, Check, Minus } from "lucide-react";
import { Reveal, SectionHead, Spotlight, cx, usePhases } from "./ui";

export default function Compare() {
  return (
    <section id="compare" className="relative mx-auto max-w-[1120px] scroll-mt-24 px-5 pt-32 md:pt-44">
      <SectionHead
        eyebrow="Why Trellis"
        title={"Keepers run your call.\nTrellis lands *your signature.*"}
        sub="Automation networks like Gelato and Chainlink Automation watch a condition off-chain and send a transaction when it holds. They work well. But the executor builds that transaction at trigger time, and it's the executor who decides it's time."
      />
      <FlowDuel />
      <Table />
      <PriorArt />
    </section>
  );
}

/* Two flows side by side, animated in sync. */
function FlowDuel() {
  const ref = useRef<HTMLDivElement>(null);
  const [p] = usePhases(4, [1300, 1500, 1500, 2600], ref);
  return (
    <div ref={ref} className="mt-14 grid gap-4 md:grid-cols-2">
      <Reveal>
        <Spotlight className="h-full p-6 md:p-7" color="rgb(255 255 255 / .06)">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-mute"><Bot size={14} /> keeper network</div>
          <div className="mt-6 space-y-2.5 font-mono text-[12px]">
            <Row on={p >= 0} label="you register a task" note="and keep it funded" />
            <Row on={p >= 1} label="executor polls checker()" note="off-chain" />
            <Row on={p >= 2} label="executor builds the call" note="at trigger time" warn />
            <Row on={p >= 3} label="your contract re-checks" note="if you wrote that check" />
          </div>
          <div className="mt-6 rounded-xl border border-line bg-ink-2 px-4 py-3 text-[14px] leading-relaxed text-fg-2">
            The payload is assembled by whoever executes. Early or wrong attempts revert on-chain and still cost gas.
          </div>
        </Spotlight>
      </Reveal>
      <Reveal delay={0.08}>
        <Spotlight className="h-full p-6 md:p-7" color="rgb(197 244 103 / .10)">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-live"><FileSignature size={14} /> trellis</div>
          <div className="mt-6 space-y-2.5 font-mono text-[12px]">
            <Row live on={p >= 0} label="you sign the final bytes" note="once, up front" />
            <Row live on={p >= 1} label="park nodes hold them" note="invalid, so 0 gas" />
            <Row live on={p >= 2} label="the latch flips on-chain" note="once, for good" />
            <Row live on={p >= 3} label="a park node forwards them" note="bytes unchanged" />
          </div>
          <div className="mt-6 rounded-xl border border-live/25 bg-live-soft px-4 py-3 text-[14px] leading-relaxed text-fg-2">
            <span className="text-fg">Anyone holding the signed bytes can land them. No one can change them.</span> Validity is checked on-chain, in the transaction's own VERIFY frame.
          </div>
        </Spotlight>
      </Reveal>
    </div>
  );
}

function Row({ on, label, note, live = false, warn = false }: { on: boolean; label: string; note: string; live?: boolean; warn?: boolean }) {
  return (
    <motion.div animate={{ opacity: on ? 1 : 0.25, x: on ? 0 : -6 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cx("flex items-center justify-between rounded-xl border px-3.5 py-3", live ? "border-live/20 bg-white/[0.02]" : "border-line bg-white/[0.02]", warn && on && "border-wait/40")}>
      <span className="flex items-center gap-2.5 text-fg">
        <span className={cx("size-1.5 rounded-full", live ? "bg-live" : warn ? "bg-wait" : "bg-fg-2")} />
        {label}
      </span>
      <span className={cx("text-[11px]", warn ? "text-wait" : "text-mute")}>{note}</span>
    </motion.div>
  );
}

const ROWS: { k: string; keeper: string; trellis: string }[] = [
  { k: "What lands on-chain", keeper: "A call the executor builds when it fires", trellis: "The exact bytes you signed, unchanged" },
  { k: "Who can land it", keeper: "The network's executors", trellis: "Anyone holding the signed bytes, once they're valid" },
  { k: "Where the condition is checked", keeper: "Off-chain by the executor, then by your contract if you wrote it", trellis: "On-chain, in a VERIFY frame. Invalid until the latch flips" },
  { k: "An early or wrong attempt", keeper: "Reverts, and still pays gas", trellis: "Can't be included, so it costs nothing" },
  { k: "Mutually exclusive outcomes", keeper: "Your contract picks a branch when it runs", trellis: "Every branch pre-signed on one nonce key. Losers never become transactions" },
  { k: "One event, many payouts", keeper: "One job per account, or a fan-out contract", trellis: "One latch flip makes every waiting cheque valid at once" },
  { k: "Before it fires", keeper: "A registered task with a funded balance", trellis: "A staked account and signed bytes. Parking itself is free" },
];

function Table() {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <Reveal delay={0.05}>
      <div className="ring-grad mt-6 overflow-hidden rounded-[26px] bg-panel/70">
        <div className="hidden grid-cols-[1fr_1.2fr_1.2fr] border-b border-line px-6 py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-mute md:grid">
          <span />
          <span>Keepers · Gelato, Chainlink Automation</span>
          <span className="text-live">Trellis</span>
        </div>
        {ROWS.map((r, i) => (
          <div key={r.k} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            className={cx("relative grid gap-2 border-b border-line px-6 py-5 last:border-b-0 md:grid-cols-[1fr_1.2fr_1.2fr] md:gap-6", "transition-colors", hover === i && "bg-white/[0.02]")}>
            <AnimatePresence>
              {hover === i && <motion.span layoutId="rowbar" className="absolute inset-y-0 left-0 w-[2px] bg-live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}
            </AnimatePresence>
            <div className="text-[15px] font-medium text-fg">{r.k}</div>
            <div className="flex gap-2.5 text-[14.5px] leading-relaxed text-mute"><Minus size={15} className="mt-1 shrink-0 text-dim" /><span><span className="mr-1 font-mono text-[10.5px] uppercase text-dim md:hidden">keepers</span>{r.keeper}</span></div>
            <div className="flex gap-2.5 text-[14.5px] leading-relaxed text-fg-2"><Check size={15} className="mt-1 shrink-0 text-live" /><span><span className="mr-1 font-mono text-[10.5px] uppercase text-live md:hidden">trellis</span>{r.trellis}</span></div>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

function PriorArt() {
  const items = [
    { t: "Base validity transactions", d: "Hold transactions on storage predicates too, but inside one sequencer with a short bound. Trellis does it in a permissionless peer-to-peer mempool, which is why the trigger is restricted to a write-once latch." },
    { t: "geth's queued pool", d: "Already holds transactions that aren't valid yet, while they wait on a nonce gap. PARK is the same idea generalized: waiting on a latch instead of a nonce." },
    { t: "EIP-8141 expiry verifier", d: "Lets a transaction stop being valid after a deadline. PARK is its missing dual: a transaction that starts being valid after an event." },
  ];
  return (
    <div className="mt-20">
      <Reveal>
        <div className="eyebrow flex items-center gap-3"><span className="h-px w-6 bg-mute/60" />Closest relatives, honestly</div>
      </Reveal>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {items.map((x, i) => (
          <Reveal key={x.t} delay={i * 0.07}>
            <div className="h-full rounded-3xl border border-line p-6">
              <div className="display-sm text-[18px] text-fg">{x.t}</div>
              <p className="mt-3 text-[14.5px] leading-relaxed text-fg-2">{x.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
