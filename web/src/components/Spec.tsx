import { motion, AnimatePresence, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Plus, Copy, Check, ArrowRight } from "lucide-react";
import { Reveal, SectionHead, Magnetic, cx } from "./ui";
import Shader from "./Shader";
import { Logo } from "./Hero";
import { REPO_URL } from "../config";

const LOG: [string, string, string][] = [
  ["12:04:11", "admit", "0x3f…a1  PARK-030 template ok · 2 sigs"],
  ["12:04:11", "park", "trigger (latch 0xA1, event 7, EXPIRED) · 1/8"],
  ["12:04:11", "gossip", "→ node B · revalidated independently"],
  ["12:04:12", "reject", "0x77…0c  PARK-050 entity cap reached"],
  ["14:52:09", "latch", "0xA1 event 7 → EXPIRED @ #1,209,340"],
  ["14:52:09", "promote", "0x3f…a1 → gateway · bytes unchanged"],
  ["14:52:21", "land", "0x3f…a1 included @ #1,209,341 idx 3"],
];
const TONE: Record<string, string> = { admit: "text-fg-2", park: "text-wait", gossip: "text-fg-2", reject: "text-bad", latch: "text-wait", promote: "text-live", land: "text-live" };

function Terminal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? LOG.length : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const id = setTimeout(() => setN((x) => (x >= LOG.length + 3 ? 0 : x + 1)), n >= LOG.length ? 1400 : 650);
    return () => clearTimeout(id);
  }, [n, inView, reduce]);
  return (
    <div ref={ref} className="ring-grad overflow-hidden rounded-[22px] bg-[#0a0c0f]">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="size-2.5 rounded-full bg-white/10" /><span className="size-2.5 rounded-full bg-white/10" /><span className="size-2.5 rounded-full bg-white/10" />
        <span className="ml-3 font-mono text-[11.5px] text-mute">yarn park:a</span>
      </div>
      <div className="h-[268px] space-y-1.5 overflow-hidden p-4 font-mono text-[12px] leading-relaxed">
        <AnimatePresence initial={false}>
          {LOG.slice(0, Math.min(n, LOG.length)).map(([t, k, m]) => (
            <motion.div key={t + k} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex gap-3 whitespace-nowrap">
              <span className="text-dim">{t}</span>
              <span className={cx("w-[58px]", TONE[k])}>{k}</span>
              <span className="truncate text-fg-2">{m}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        <span className="inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-live/70" />
      </div>
    </div>
  );
}

const CODE = `// a parked cheque: four frames, signed once
[ VERIFY  expiry_verify(deadline),
  VERIFY  self_verify(latch, eventId, tag),
  SENDER  pay(winner),
  SENDER  pay(fee) ]`;

function CodeCard() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(CODE); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  const lines = CODE.split("\n");
  return (
    <div className="ring-grad relative overflow-hidden rounded-[22px] bg-[#0a0c0f]">
      <button onClick={copy} aria-label="Copy" className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg border border-line text-mute hover:text-fg">
        {copied ? <Check size={14} className="text-live" /> : <Copy size={14} />}
      </button>
      <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.9]">
        {lines.map((l, i) => (
          <div key={i}>
            <span className="mr-4 inline-block w-4 select-none text-right text-dim">{i + 1}</span>
            {l.startsWith("//") ? <span className="text-dim">{l}</span> : l.split(/(VERIFY|SENDER)/).map((part, j) =>
              part === "VERIFY" ? <span key={j} className="text-live">{part}</span> : part === "SENDER" ? <span key={j} className="text-wait">{part}</span> : <span key={j} className="text-fg-2">{part}</span>
            )}
          </div>
        ))}
      </pre>
    </div>
  );
}

const RULES = [
  ["PARK-010", "The signed trigger names the latch, the event and the expected tag."],
  ["PARK-020", "The sender is staked, so its foreign-state read is admissible."],
  ["PARK-030", "Bound to an allow-listed account template. Every signature verified."],
  ["PARK-040", "Every parked transaction carries an expiry frame."],
  ["PARK-050", "Live caps per sender and per trigger. Entry P+1 is rejected."],
  ["PARK-060", "Index by (latch, event, tag). Promote the match, evict the losers unsimulated."],
  ["PARK-070", "The park area may hold mutually exclusive siblings. Only the winner goes live."],
  ["PARK-080", "Optional gossip. Peers revalidate on their own."],
];

export function Spec() {
  return (
    <section id="spec" className="relative mx-auto max-w-[1120px] scroll-mt-24 px-5 pt-32 md:pt-44">
      <SectionHead eyebrow="The rule" title={"A node policy,\nnot a *fork.*"} sub="PARK is written as rules any ERC-8421 node can opt into. No new opcodes, no consensus change. PARK-070 is proposed as an amendment to ERC-8421." />
      <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Reveal><Terminal /></Reveal>
        <Reveal delay={0.08}><CodeCard /></Reveal>
      </div>
      <Reveal delay={0.05}>
        <div className="mt-4 grid rounded-[22px] border border-line md:grid-cols-2">
          {RULES.map(([id, t], i) => (
            <div key={id} className={cx("flex gap-5 border-line px-6 py-4", i < RULES.length - (RULES.length % 2 === 0 ? 2 : 1) && "border-b", i % 2 === 0 && "md:border-r", i >= RULES.length - 2 && "md:border-b-0", i === RULES.length - 2 && "border-b md:border-b-0")}>
              <span className="w-[72px] shrink-0 font-mono text-[12px] text-live">{id}</span>
              <span className="text-[14.5px] text-fg-2">{t}</span>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

const QA = [
  ["How does a node know a parked transaction just became valid?", "Its validity depends on one latch slot, and the latch is write-once. So a node only re-checks the transactions indexed on a slot when that slot flips, and a flip can only turn them valid. Proposed next: a canonical latch at a fixed address and a latch_verify frame that nodes evaluate with a single storage read, so even plain EOAs can park."],
  ["Where are parked transactions stored?", "In a park area on each node, kept apart from the live mempool. It never counts against the live pool's limits and never goes on its gossip topic. Today two nodes hold it in memory and revalidate each other's entries; persistence to disk is next. You keep the signed bytes too, and can park them anywhere."],
  ["What if someone floods a node with 100 million transactions?", "Admission runs the cheapest checks first: size, dedup and frame shape cost microseconds and happen before any signature or state read. What gets in is capped per sender and per latch, and the cap is sized by stake, so filling the park area means locking real money. A flip only touches the cheques on its own latch."],
  ["Who pays to flip the latch?", "Whoever calls expire() or attest() pays for that one call, and any account can make it. Each promoted transaction pays its own gas when it lands. Proposed: the promoted transaction tips whoever made the flip."],
  ["Can a parked cheque land early?", "No. Its VERIFY frame reads the latch, so before the flip it's invalid and no block can include it. That guarantee comes from EIP-8141 itself. What Trellis adds is a legal place for the transaction to wait."],
  ["Isn't a deadman switch just a Safe module with claim()?", "For a single switch, a module works fine. Trellis is the layer underneath: the mempool holds the signed transaction itself, conflicting outcomes wait side by side until one is chosen, and one flip settles every cheque on an event."],
];

export function Questions() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative mx-auto max-w-[1120px] px-5 pt-32 md:pt-44">
      <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
        <SectionHead eyebrow="Hard questions" title={"The ones the\nEF team *asked.*"} sub="Asked at the Ethereum Foundation booth in Mumbai. Here are the straight answers." />
        <Reveal delay={0.1}>
          <div className="divide-y divide-line border-y border-line">
            {QA.map(([q, a], i) => (
              <div key={i}>
                <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-6 py-5 text-left" aria-expanded={open === i}>
                  <span className="text-[16.5px] font-medium text-fg">{q}</span>
                  <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="ml-auto grid size-8 shrink-0 place-items-center rounded-full border border-line-2 text-fg-2"><Plus size={15} /></motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                      <p className="max-w-[620px] pb-6 text-[15.5px] leading-relaxed text-fg-2">{a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section className="relative mt-36 overflow-hidden border-t border-line">
      <Shader className="absolute inset-0 -z-10 opacity-80" density={9} focus={[0, 0.1]} />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_100%,transparent,var(--color-ink))]" />
      <div className="mx-auto max-w-[1120px] px-5 py-32 text-center md:py-44">
        <h2 className="display mx-auto max-w-[14ch] text-[clamp(40px,6.4vw,84px)]">Signed today. <span className="serif-i text-live" style={{ fontSize: "1.06em" }}>Delivered</span> when it counts.</h2>
        <p className="mx-auto mt-6 max-w-[520px] text-[17px] text-fg-2">Open source and built to be broken. Read the rule, run two nodes, and try to land a cheque early.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Magnetic href={REPO_URL}>View the code <ArrowRight size={16} /></Magnetic>
          <Magnetic href="#how" variant="ghost">Replay the demo</Magnetic>
        </div>
      </div>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] text-mute">
          <span className="flex items-center gap-2.5"><Logo size={18} /> Trellis · ETHGlobal Mumbai 2026 · EF Frame Transaction alt mempool track</span>
          <span className="flex gap-6"><a href="#spec" className="hover:text-fg">Rule</a><a href="#faq" className="hover:text-fg">FAQ</a><a href={REPO_URL} className="hover:text-fg">GitHub</a></span>
        </div>
      </footer>
    </section>
  );
}
