"use client";

import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Tag = 1 | 2 | 3;
type LatchState = 0 | 1 | 2 | 3;
type Status = "parked" | "promoting" | "promoted" | "evicted";

const STATE_NAME = ["UNSET", "YES", "NO", "EXPIRED"] as const;
const EASE = [0.16, 1, 0.3, 1] as const;

interface Cheque {
  id: string;
  name: string;
  tag: Tag;
  pays: string;
  signers: string;
  status: Status;
  why?: string;
}

interface LogLine {
  t: string;
  rule: string;
  text: string;
  hot?: boolean;
}

const DLC_CHEQUES: Cheque[] = [
  { id: "yes", name: "CET_YES", tag: 1, pays: "Alice ← 0.198 ETH", signers: "alice, bob", status: "parked" },
  { id: "no", name: "CET_NO", tag: 2, pays: "Bob ← 0.198 ETH", signers: "alice, bob", status: "parked" },
  {
    id: "refund",
    name: "CET_REFUND",
    tag: 3,
    pays: "Alice ← 0.1 · Bob ← 0.1",
    signers: "alice, bob",
    status: "parked",
  },
];

const RESCUE: Cheque = {
  id: "rescue",
  name: "RESCUE",
  tag: 3,
  pays: "beneficiary ← 0.02 ETH",
  signers: "owner",
  status: "parked",
};

const INTERVAL = 10; // simulated heartbeat, seconds
const GRACE = 3;

function useClock() {
  const start = useRef<number>(0);
  useEffect(() => {
    start.current = performance.now();
  }, []);
  return useCallback(() => {
    const s = (performance.now() - start.current) / 1000;
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  }, []);
}

export function LatchSimulator() {
  const [tab, setTab] = useState<"dlc" | "deadman">("dlc");

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.6, ease: EASE }}>
      <div className="sim">
        <div className="sim__bar">
          <div className="tabs" role="tablist" aria-label="Workload">
            {(
              [
                ["dlc", "Binary DLC"],
                ["deadman", "Deadman rescue"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                id={`tab-${key}`}
                aria-controls={`panel-${key}`}
                aria-selected={tab === key}
                className="tab"
                onClick={() => setTab(key)}
              >
                {label}
                {tab === key && <motion.span layoutId="tab-ink" className="tab__ink" />}
              </button>
            ))}
          </div>
          <span className="sim__note">Simulation · runs in your browser · no chain calls</span>
        </div>
        {tab === "dlc" ? <Dlc key="dlc" /> : <Deadman key="deadman" />}
      </div>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ */

function ChequeCard({ c, keyLabel }: { c: Cheque; keyLabel: string }) {
  const chip = c.status === "promoting" ? "parked" : c.status;
  return (
    <motion.article
      layout
      layoutId={`cheque-${c.id}`}
      className="cheque"
      data-status={c.status}
      initial={{ opacity: 0, y: 8 }}
      animate={
        c.status === "evicted"
          ? { opacity: [1, 1, 0.5], y: [0, -6, 0], transition: { duration: 0.9, ease: EASE, times: [0, 0.35, 1] } }
          : { opacity: 1, y: 0 }
      }
      exit={{ opacity: 0, y: -8 }}
    >
      {c.status === "evicted" && (
        <motion.span
          className="cheque__strike"
          aria-hidden
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
        />
      )}
      <div className="cheque__top">
        <span className="cheque__name">{c.name}</span>
        <span className="chip" data-s={chip}>
          <i />
          {c.status === "promoting" ? "promoting" : c.status}
        </span>
      </div>
      <dl className="cheque__rows">
        <dt>trigger</dt>
        <dd>latch = {STATE_NAME[c.tag]}</dd>
        <dt>pays</dt>
        <dd>{c.pays}</dd>
        <dt>nonce</dt>
        <dd>{keyLabel}</dd>
        <dt>signed by</dt>
        <dd>{c.signers}</dd>
      </dl>
      <AnimatePresence initial={false}>
        {c.why && (
          <motion.p
            className="cheque__why"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {c.why}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function LatchFace({
  label,
  state,
  children,
}: {
  label: string;
  state: LatchState;
  children?: React.ReactNode;
}) {
  return (
    <div className="latch__face">
      <div className="latch__label">{label}</div>
      <div className="latch__state" data-set={state !== 0} aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={state}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
          >
            {STATE_NAME[state]}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="latch__track" aria-hidden>
        {STATE_NAME.map((n, i) => (
          <span key={n} data-on={i === state} data-hot={i === state && i !== 0}>
            {n}
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}

function Log({ lines }: { lines: LogLine[] }) {
  return (
    <div className="log" aria-live="polite" aria-label="Park node log">
      <ol>
        <AnimatePresence initial={false}>
          {lines.slice(-5).map((l, i) => (
            <motion.li
              key={`${l.t}-${l.text}-${i}`}
              data-hot={l.hot}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <span className="t">{l.t}</span>
              <span className="r">{l.rule}</span>
              <span>{l.text}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

function Chain({ landed, keyLabel, balances }: { landed: Cheque | null; keyLabel: string; balances: [string, string, boolean][] }) {
  return (
    <div className="chain">
      <div className="slot">
        <div className="slot__label">
          <span>block #41,218</span>
          <span>{landed ? "included" : "pending"}</span>
        </div>
        {landed ? (
          <ChequeCard c={landed} keyLabel={keyLabel} />
        ) : (
          <p className="slot__empty">Nothing lands until the latch flips.</p>
        )}
      </div>
      <div>
        {balances.map(([who, amt, up]) => (
          <div className="balance" key={who}>
            <span>{who}</span>
            <motion.b key={amt} data-up={up} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              {amt}
            </motion.b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Dlc() {
  const clock = useClock();
  const [latch, setLatch] = useState<LatchState>(0);
  const [cheques, setCheques] = useState<Cheque[]>(DLC_CHEQUES);
  const [landed, setLanded] = useState<Cheque | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const timers = useRef<number[]>([]);

  const push = useCallback((rule: string, text: string, hot?: boolean) => {
    setLog((l) => [...l, { t: clock(), rule, text, hot }]);
  }, [clock]);

  useEffect(() => {
    push("PARK-030", "3 cheques admitted · signatures recovered to alice, bob");
    push("PARK-070", "siblings held together: one nonce key 1/0, three values");
    const t = timers.current;
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const tryLive = () => push("REJECT", "live mempool: self_verify reverts, latch is UNSET");

  const flip = (state: LatchState) => {
    if (latch !== 0) return;
    setLatch(state);
    const winner = cheques.find((c) => c.tag === state)!;
    push(
      "LATCH",
      state === 3 ? "deadline + grace passed · anyone calls expire()" : `oracle attests ${STATE_NAME[state]}`,
      true
    );
    later(450, () => {
      setCheques((cs) =>
        cs.map((c) =>
          c.tag === state ? { ...c, status: "promoting" } : { ...c, status: "evicted", why: "tag ≠ latch · evicted without simulation" }
        )
      );
      push("PARK-060", `evict ${cheques.filter((c) => c.tag !== state).map((c) => c.name).join(", ")} · not simulated`);
    });
    later(1100, () => push("PARK-060", `promote ${winner.name} · same signed bytes → gateway`, true));
    later(2000, () => {
      setCheques((cs) => cs.filter((c) => c.id !== winner.id).map((c) => ({ ...c, why: "nonce 1/0 consumed · can never land" })));
      setLanded({ ...winner, status: "promoted", why: "landed · shared nonce key consumed" });
      push("INCLUDED", `${winner.name} in block #41,218 · siblings now invalid`, true);
    });
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLatch(0);
    setCheques(DLC_CHEQUES);
    setLanded(null);
    setLog([{ t: clock(), rule: "RESET", text: "new event · 3 cheques re-parked" }]);
  };

  const balances = useMemo<[string, string, boolean][]>(() => {
    if (!landed) return [
      ["alice", "0.000", false],
      ["bob", "0.000", false],
    ];
    if (landed.tag === 1) return [
      ["alice", "+0.198", true],
      ["bob", "0.000", false],
    ];
    if (landed.tag === 2) return [
      ["alice", "0.000", false],
      ["bob", "+0.198", true],
    ];
    return [
      ["alice", "+0.100", true],
      ["bob", "+0.100", true],
    ];
  }, [landed]);

  return (
    <LayoutGroup id="dlc">
      <div className="sim__body" id="panel-dlc" role="tabpanel" aria-labelledby="tab-dlc">
        <section className="col">
          <h3 className="col__title">
            Park area <span>node A · P=4 E=8</span>
          </h3>
          <div className="stack">
            <AnimatePresence mode="popLayout">
              {cheques.map((c) => (
                <ChequeCard key={c.id} c={c} keyLabel="key 1 · seq 0" />
              ))}
            </AnimatePresence>
          </div>
        </section>
        <section className="col latch">
          <h3 className="col__title" style={{ marginBottom: 0 }}>
            Latch <span>write-once</span>
          </h3>
          <LatchFace label="limbo:dlc · oracle-attested" state={latch} />
          <div className="actions">
            <button className="act act--hot" disabled={latch !== 0} onClick={() => flip(1)}>
              Oracle attests YES <small>attest(true)</small>
            </button>
            <button className="act act--hot" disabled={latch !== 0} onClick={() => flip(2)}>
              Oracle attests NO <small>attest(false)</small>
            </button>
            <button className="act" disabled={latch !== 0} onClick={() => flip(3)}>
              Nobody attests <small>expire()</small>
            </button>
            <button className="act" disabled={latch !== 0} onClick={tryLive}>
              Send a cheque now <small>live mempool</small>
            </button>
          </div>
          {latch !== 0 && (
            <p className="latch__lock">
              <b>Latch is set.</b> Write-once: it can never read UNSET again.
            </p>
          )}
        </section>
        <section className="col">
          <h3 className="col__title">
            Chain <span>simulated</span>
          </h3>
          <Chain landed={landed} keyLabel="key 1 · seq 0" balances={balances} />
        </section>
      </div>
      <Log lines={log} />
      <div className="sim__foot">
        <span>Alice and Bob sign all three outcomes up front. Then they can both go offline.</span>
        <button className="linkbtn" onClick={reset}>
          Reset the event
        </button>
      </div>
    </LayoutGroup>
  );
}

/* ------------------------------------------------------------------ */

function Deadman() {
  const clock = useClock();
  const [latch, setLatch] = useState<LatchState>(0);
  const [online, setOnline] = useState(true);
  const [left, setLeft] = useState(INTERVAL);
  const [cheque, setCheque] = useState<Cheque | null>(RESCUE);
  const [landed, setLanded] = useState<Cheque | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const timers = useRef<number[]>([]);
  const onlineRef = useRef(online);
  const leftRef = useRef(INTERVAL);
  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  const push = useCallback((rule: string, text: string, hot?: boolean) => {
    setLog((l) => [...l, { t: clock(), rule, text, hot }]);
  }, [clock]);

  useEffect(() => {
    push("PARK-030", "rescue admitted · signed by owner · account staked");
    push("PARK-040", "expiry_verify outlives deadline + grace");
    const t = timers.current;
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // heartbeat clock
  useEffect(() => {
    if (latch !== 0) return;
    const id = window.setInterval(() => {
      let next = Math.max(-GRACE, +(leftRef.current - 0.1).toFixed(2));
      if (onlineRef.current && next <= INTERVAL * 0.35) {
        push("PING", `owner pings · deadline +${INTERVAL}s`);
        next = INTERVAL;
      }
      leftRef.current = next;
      setLeft(next);
    }, 100);
    return () => clearInterval(id);
  }, [latch, push]);

  const goOffline = () => {
    setOnline(false);
    push("OFFLINE", "owner stops pinging · nobody re-signs anything", true);
  };

  const expire = () => {
    if (latch !== 0 || left > -GRACE) return;
    setLatch(3);
    push("LATCH", "a stranger calls expire() · latch → EXPIRED", true);
    timers.current.push(
      window.setTimeout(() => {
        setCheque((c) => (c ? { ...c, status: "promoting" } : c));
        push("PARK-060", "promote RESCUE · same signed bytes → gateway", true);
      }, 500),
      window.setTimeout(() => {
        setCheque(null);
        setLanded({ ...RESCUE, status: "promoted", why: "landed while the owner was offline" });
        push("INCLUDED", "RESCUE in block #41,218 · beneficiary paid", true);
      }, 1500)
    );
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLatch(0);
    setOnline(true);
    leftRef.current = INTERVAL;
    setLeft(INTERVAL);
    setCheque(RESCUE);
    setLanded(null);
    setLog([{ t: clock(), rule: "RESET", text: "owner back · rescue re-parked" }]);
  };

  const inGrace = left <= 0 && left > -GRACE;
  const canExpire = latch === 0 && left <= -GRACE;
  const pct = left > 0 ? left / INTERVAL : (left + GRACE) / GRACE;

  return (
    <LayoutGroup id="deadman">
      <div className="sim__body" id="panel-deadman" role="tabpanel" aria-labelledby="tab-deadman">
        <section className="col">
          <h3 className="col__title">
            Park area <span>node A · P=4 E=8</span>
          </h3>
          <div className="stack">
            <AnimatePresence mode="popLayout">{cheque && <ChequeCard key="rescue" c={cheque} keyLabel="key 1 · seq 0" />}</AnimatePresence>
            {!cheque && <p className="slot__empty">Park area empty. The rescue has landed.</p>}
          </div>
        </section>
        <section className="col latch">
          <h3 className="col__title" style={{ marginBottom: 0 }}>
            Latch <span>heartbeat</span>
          </h3>
          <LatchFace label="limbo:rescue · owner pings" state={latch}>
            <div className="beat">
              <div className="beat__bar">
                <motion.div
                  className="beat__fill"
                  data-grace={left <= 0}
                  animate={{ width: `${Math.max(0, Math.min(1, latch === 0 ? pct : 0)) * 100}%` }}
                  transition={{ duration: 0.12, ease: "linear" }}
                />
              </div>
              <div className="beat__meta">
                <span>
                  {latch !== 0
                    ? "expired"
                    : left > 0
                      ? `deadline in ${left.toFixed(1)}s`
                      : inGrace
                        ? `grace ${(left + GRACE).toFixed(1)}s`
                        : "grace over"}
                </span>
                <span>{online ? "owner online" : "owner offline"}</span>
              </div>
            </div>
          </LatchFace>
          <div className="actions">
            <button className="act act--hot" disabled={!online || latch !== 0} onClick={goOffline}>
              Owner goes silent <small>stop pinging</small>
            </button>
            <button className="act act--hot" disabled={!canExpire} onClick={expire}>
              Anyone expires it <small>expire()</small>
            </button>
            <button
              className="act"
              disabled={latch !== 0}
              onClick={() => push("REJECT", "live mempool: self_verify reverts, latch not EXPIRED")}
            >
              Send the rescue now <small>live mempool</small>
            </button>
          </div>
          <p className="latch__lock">
            Time compressed: {INTERVAL}s interval, {GRACE}s grace.
          </p>
        </section>
        <section className="col">
          <h3 className="col__title">
            Chain <span>simulated</span>
          </h3>
          <Chain
            landed={landed}
            keyLabel="key 1 · seq 0"
            balances={[["beneficiary", landed ? "+0.020" : "0.000", !!landed]]}
          />
        </section>
      </div>
      <Log lines={log} />
      <div className="sim__foot">
        <span>The owner signed once, months ago. No keeper chooses who gets paid.</span>
        <button className="linkbtn" onClick={reset}>
          Reset
        </button>
      </div>
    </LayoutGroup>
  );
}
