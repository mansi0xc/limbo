"use client";

import Link from "next/link";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ago,
  chequeName,
  eth,
  NODE_A,
  NODE_B,
  short,
  STATE_NAME,
  useParkNode,
  type EntryView,
  type LatchView,
  type NodeFeed,
} from "@/lib/park";

const EASE = [0.16, 1, 0.3, 1] as const;
type Kind = "rescue" | "dlc";

interface LogLine {
  key: string;
  t: string;
  rule: string;
  text: string;
  hot?: boolean;
}

function useNow(ms = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour12: false });

/* ------------------------------------------------------------------ */

export function ParkExplorer() {
  const a = useParkNode(NODE_A);
  const b = useParkNode(NODE_B);
  const [kind, setKind] = useState<Kind>("rescue");
  const log = useEventLog(a, b);
  const now = useNow();

  const latch = (a.status?.latches ?? b.status?.latches)?.find((l) => l.kind === kind) ?? null;
  const anyLive = a.link === "live" || b.link === "live";
  const bothDown = a.link === "offline" && b.link === "offline";

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.6, ease: EASE }}>
      <div className="sim px">
        <div className="sim__bar">
          <div className="tabs" role="tablist" aria-label="Workload">
            {(
              [
                ["rescue", "Deadman rescue"],
                ["dlc", "Binary DLC"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={kind === key}
                className="tab"
                onClick={() => setKind(key)}
              >
                {label}
                {kind === key && <motion.span layoutId="px-tab-ink" className="tab__ink" />}
              </button>
            ))}
          </div>
          <span className="px__links">
            <LinkDot feed={a} label="A" />
            <LinkDot feed={b} label="B" />
            <span className="sim__note">{anyLive ? "Live · read-only" : "Waiting for park nodes"}</span>
          </span>
        </div>

        {bothDown ? (
          <Offline />
        ) : (
          <div className="sim__body px__body">
            <LatchColumn latch={latch} now={now} />
            <NodeColumn feed={a} kind={kind} latch={latch} now={now} />
            <NodeColumn feed={b} kind={kind} latch={latch} now={now} />
          </div>
        )}

        <div className="log" aria-live="polite" aria-label="Park events">
          {log.length === 0 ? (
            <p className="px__quiet">Events from both nodes appear here as cheques are parked, promoted and evicted.</p>
          ) : (
            <ol>
              <AnimatePresence initial={false}>
                {log.slice(-6).map((l) => (
                  <motion.li
                    key={l.key}
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
          )}
        </div>

        <div className="sim__foot">
          <span>
            Polling <code>{NODE_A}</code> and <code>{NODE_B}</code> every second. Nothing here can submit a
            transaction.
          </span>
          <Link className="linkbtn" href="/playground">
            No nodes? Try the playground
          </Link>
        </div>
      </div>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ */

function LinkDot({ feed, label }: { feed: NodeFeed; label: string }) {
  return (
    <span className="px__dot" data-link={feed.link} title={`Node ${label}: ${feed.link} (${feed.url})`}>
      <i />
      {label}
    </span>
  );
}

function LatchColumn({ latch, now }: { latch: LatchView | null; now: number }) {
  const state = latch?.state ?? null;
  const deadlineMs = latch?.deadline ? Number(latch.deadline) * 1000 : null;
  const until = deadlineMs !== null ? deadlineMs - now : null;

  return (
    <div className="col">
      <div className="col__title">
        Latch <span>{latch ? short(latch.latch) : "—"}</span>
      </div>
      <div className="latch">
        <div className="latch__face">
          <div className="latch__label">state</div>
          <div className="latch__state" data-set={state !== null && state !== 0} aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={String(state)}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
              >
                {state === null ? "…" : STATE_NAME[state]}
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
        </div>

        <dl className="cheque__rows px__facts">
          <dt>deadline</dt>
          <dd>
            {until === null
              ? "not opened"
              : state && state !== 0
                ? clock(deadlineMs!)
                : until > 0
                  ? `in ${ago(until)}`
                  : `passed ${ago(-until)} ago`}
          </dd>
          <dt>event</dt>
          <dd>{short(latch?.eventId, 8, 6)}</dd>
          <dt>account</dt>
          <dd>{short(latch?.account)}</dd>
          {latch?.error && (
            <>
              <dt>read</dt>
              <dd className="px__err">{latch.error}</dd>
            </>
          )}
        </dl>

        <p className="px__policy">
          <b>A</b> promotes the matching cheque as soon as the latch settles. <b>B</b> revalidates every cheque on its
          own and promotes after a delay if it is still parked, so the trigger lands even if A is down.
        </p>
      </div>
    </div>
  );
}

function NodeColumn({
  feed,
  kind,
  latch,
  now,
}: {
  feed: NodeFeed;
  kind: Kind;
  latch: LatchView | null;
  now: number;
}) {
  const s = feed.status;
  const role = s?.role ?? (feed.url === NODE_A ? "a" : "b");
  const primary = s?.promotion?.primary ?? role === "a";
  const entries = useMemo(
    () => (s?.entries ?? []).filter((e) => e.kind === kind).sort((x, y) => x.receivedAt - y.receivedAt),
    [s, kind]
  );
  const counts = (st: string) => entries.filter((e) => e.status === st).length;

  // A fallback node's countdown: from the moment it saw the latch settle to the moment it may promote.
  const settledAt = s?.promotion?.settledAt?.[kind];
  const delay = s?.promotion?.fallbackAfterMs ?? 0;
  const waiting =
    !primary &&
    feed.link === "live" &&
    settledAt !== undefined &&
    latch?.state !== undefined &&
    latch?.state !== null &&
    entries.some((e) => e.status === "parked" && e.trigger.expectedTag === latch.state);

  return (
    <div className="col px__node" data-link={feed.link}>
      <div className="col__title">
        <span className="px__nodename">
          Node {role.toUpperCase()}
          <em data-primary={primary}>{primary ? "primary" : "fallback"}</em>
        </span>
        <span>
          {counts("parked")} parked · {counts("promoted")} landed · {counts("evicted")} evicted
        </span>
      </div>

      <AnimatePresence initial={false}>
        {feed.link === "offline" && (
          <motion.p
            className="px__down"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            Down{feed.seenAt ? ` · last seen ${ago(now - feed.seenAt)} ago` : ""}. Its park area is on disk in{" "}
            <code>.park/{role}.json</code> and reloads on restart.
          </motion.p>
        )}
        {waiting && <Fallback settledAt={settledAt!} delay={delay} now={now} />}
      </AnimatePresence>

      {entries.length === 0 ? (
        <p className="slot__empty">
          {feed.link === "connecting" ? "Connecting…" : feed.link === "offline" ? "No data." : "Nothing parked yet."}
        </p>
      ) : (
        <motion.div layout className="stack">
          <AnimatePresence initial={false}>
            {entries.map((e) => (
              <Cheque key={e.id} e={e} now={now} stale={feed.link !== "live"} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function Fallback({ settledAt, delay, now }: { settledAt: number; delay: number; now: number }) {
  const left = settledAt + delay - now;
  const done = Math.min(1, Math.max(0, (now - settledAt) / Math.max(1, delay)));
  return (
    <motion.div
      className="px__fallback"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="px__fallback-row">
        <span>Fallback</span>
        <b>{left > 0 ? `takes over in ${ago(left)}` : "promoting"}</b>
      </div>
      <div className="px__bar" aria-hidden>
        <motion.i animate={{ scaleX: done }} transition={{ duration: 0.5, ease: "linear" }} />
      </div>
    </motion.div>
  );
}

function Cheque({ e, now, stale }: { e: EntryView; now: number; stale: boolean }) {
  const chip = e.status === "rejected" ? "evicted" : e.status;
  const retryIn = e.status === "parked" && e.nextAttemptAt ? e.nextAttemptAt - now : 0;

  return (
    <motion.article
      layout
      className="cheque"
      data-status={e.status === "expired" || e.status === "failed" ? "evicted" : e.status}
      data-stale={stale}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: stale ? 0.55 : 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      {(e.status === "evicted" || e.status === "expired" || e.status === "failed") && (
        <motion.span
          className="cheque__strike"
          aria-hidden
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
        />
      )}
      <div className="cheque__top">
        <span className="cheque__name">{chequeName(e)}</span>
        <span className="chip" data-s={chip}>
          <i />
          {e.status === "promoted" ? "landed" : e.status}
        </span>
      </div>
      <dl className="cheque__rows">
        <dt>trigger</dt>
        <dd>latch = {STATE_NAME[e.trigger.expectedTag] ?? e.trigger.expectedTag}</dd>
        {e.payouts && e.payouts.length > 0 && (
          <>
            <dt>pays</dt>
            <dd>{e.payouts.map((p) => `${short(p.to)} ← ${eth(p.value)}`).join(" · ")}</dd>
          </>
        )}
        <dt>nonce</dt>
        <dd>
          key {e.nonceKey ?? "?"} · seq {e.nonceSeq ?? "?"}
        </dd>
        <dt>bytes</dt>
        <dd>{short(e.txId, 10, 6)}</dd>
        {e.status === "promoted" && (
          <>
            <dt>landed</dt>
            <dd>
              block {e.includedBlock ?? "?"} · {short(e.txHash, 10, 6)}
            </dd>
            {e.gasUsed && (
              <>
                <dt>verify gas</dt>
                <dd>{Number(e.gasUsed).toLocaleString()}</dd>
              </>
            )}
          </>
        )}
        {e.attempts ? (
          <>
            <dt>attempts</dt>
            <dd>
              {e.attempts}
              {retryIn > 0 ? ` · retry in ${ago(retryIn)}` : ""}
            </dd>
          </>
        ) : null}
      </dl>
      {e.error && e.status !== "promoted" && <p className="cheque__why">{e.error}</p>}
    </motion.article>
  );
}

function Offline() {
  return (
    <div className="px__offline">
      <div>
        <h3>No park node is reachable.</h3>
        <p>
          The explorer reads two local park nodes. Deploy once, then start both nodes in separate terminals and run a
          workload. This page updates as the cheques move.
        </p>
      </div>
      <pre>
        <code>
          {`yarn deploy        # once, writes .trellis-state.json
yarn park:a        # primary · :8787
yarn park:b        # fallback · :8788
yarn demo:deadman  # or demo:dlc`}
        </code>
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Turns successive status snapshots of both nodes into a readable event log. */
function useEventLog(a: NodeFeed, b: NodeFeed): LogLine[] {
  const [lines, setLines] = useState<LogLine[]>([]);
  const seen = useRef<Record<string, Map<string, string>>>({ a: new Map(), b: new Map() });
  const links = useRef<Record<string, string>>({});
  const primed = useRef<Set<string>>(new Set());
  const latchSeen = useRef<Map<string, number | null>>(new Map());
  const counter = useRef(0);

  useEffect(() => {
    const out: LogLine[] = [];
    const push = (rule: string, text: string, hot = false) =>
      out.push({ key: `l${counter.current++}`, t: clock(Date.now()), rule, text, hot });

    for (const [name, feed] of [
      ["a", a],
      ["b", b],
    ] as const) {
      const prevLink = links.current[name];
      if (prevLink === "live" && feed.link === "offline") push("NODE", `${name.toUpperCase()} went down`, true);
      if (prevLink === "offline" && feed.link === "live") push("NODE", `${name.toUpperCase()} is back`);
      links.current[name] = feed.link;

      if (feed.link !== "live" || !feed.status) continue;
      const before = seen.current[name];
      // The first snapshot from a node is its current state, not news: record it silently.
      const first = !primed.current.has(name);
      primed.current.add(name);
      for (const e of feed.status.entries) {
        const was = before.get(e.id);
        before.set(e.id, e.status);
        if (first || was === e.status) continue;
        const who = `${name.toUpperCase()} · ${chequeName(e)}`;
        if (!was) push("PARK-060", `${who} parked`);
        else if (e.status === "promoted") push("PROMOTE", `${who} landed in block ${e.includedBlock ?? "?"}`, true);
        else if (e.status === "evicted") push("PARK-060", `${who} evicted · ${e.error ?? ""}`);
        else if (e.status === "expired") push("PARK-040", `${who} expired`);
        else if (e.status === "failed") push("FAILED", `${who} · ${e.error ?? ""}`, true);
      }

    }

    // A latch only ever leaves UNSET once, and both nodes read it a moment apart: log the first node
    // that reports the new state, and reset quietly when every live node reads UNSET again (a redeploy).
    const live = [a, b].filter((f) => f.link === "live" && f.status);
    for (const kind of ["rescue", "dlc"] as const) {
      const states = live
        .map((f) => f.status!.latches?.find((l) => l.kind === kind)?.state)
        .filter((s): s is number => s !== null && s !== undefined);
      if (!states.length) continue;
      const was = latchSeen.current.get(kind);
      const settled = states.find((s) => s !== 0);
      if (settled !== undefined && was !== settled) {
        if (was !== undefined) push("LATCH", `${kind} latch → ${STATE_NAME[settled]}`, true);
        latchSeen.current.set(kind, settled);
      } else if (settled === undefined) {
        latchSeen.current.set(kind, 0);
      }
    }

    if (out.length) setLines((prev) => [...prev, ...out].slice(-40));
  }, [a, b]);

  return lines;
}
