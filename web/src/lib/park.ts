"use client";

import { useEffect, useRef, useState } from "react";

/** What a park node's `GET /status` returns (src/park/node.ts). */
export type EntryStatus = "parked" | "promoted" | "evicted" | "expired" | "failed" | "rejected";

export interface EntryView {
  id: string;
  kind: "rescue" | "dlc";
  sender: string;
  trigger: { latch: string; eventId: string; expectedTag: number };
  status: EntryStatus;
  expiry: string;
  signers: string[];
  txHash?: string;
  gasUsed?: string;
  includedBlock?: string;
  error?: string;
  txId?: string;
  attempts?: number;
  nextAttemptAt?: number;
  nonceKey?: string;
  nonceSeq?: string;
  payouts?: { to: string | null; value: string }[];
  receivedAt: number;
}

export interface LatchView {
  kind: "rescue" | "dlc";
  account: string;
  latch: string;
  eventId: string;
  state: number | null;
  deadline: string | null;
  readAt: number | null;
  error?: string;
}

export interface NodeStatus {
  role: "a" | "b";
  peer?: string;
  now?: number;
  promotion?: { primary: boolean; fallbackAfterMs: number; settledAt: Record<string, number> };
  latches?: LatchView[];
  caps: { perTrigger: number; perEntity: number };
  entries: EntryView[];
  counts: Record<string, number>;
}

export type Link = "connecting" | "live" | "offline";

export interface NodeFeed {
  url: string;
  link: Link;
  status: NodeStatus | null;
  /** Wall-clock ms of the last good response. */
  seenAt: number | null;
}

export const NODE_A = process.env.NEXT_PUBLIC_PARK_A ?? "http://127.0.0.1:8787";
export const NODE_B = process.env.NEXT_PUBLIC_PARK_B ?? "http://127.0.0.1:8788";

/** Polls one park node. Two misses in a row count as offline, so one slow poll does not flicker. */
export function useParkNode(url: string, intervalMs = 1000): NodeFeed {
  const [feed, setFeed] = useState<NodeFeed>({ url, link: "connecting", status: null, seenAt: null });
  const misses = useRef(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const ctrl = new AbortController();
      const cut = setTimeout(() => ctrl.abort(), Math.max(800, intervalMs));
      try {
        const res = await fetch(`${url}/status`, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const status = (await res.json()) as NodeStatus;
        misses.current = 0;
        if (alive) setFeed({ url, link: "live", status, seenAt: Date.now() });
      } catch {
        misses.current += 1;
        if (alive && misses.current >= 2) setFeed((prev) => ({ ...prev, url, link: "offline" }));
      } finally {
        clearTimeout(cut);
        if (alive) timer = setTimeout(poll, intervalMs);
      }
    };

    void poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [url, intervalMs]);

  return feed;
}

export const STATE_NAME = ["UNSET", "YES", "NO", "EXPIRED"] as const;

export function chequeName(e: Pick<EntryView, "kind" | "trigger">): string {
  if (e.kind === "rescue") return "RESCUE";
  return ["CET_?", "CET_YES", "CET_NO", "CET_REFUND"][e.trigger.expectedTag] ?? `CET_${e.trigger.expectedTag}`;
}

export const short = (hex?: string | null, head = 6, tail = 4): string =>
  !hex ? "—" : hex.length <= head + tail + 2 ? hex : `${hex.slice(0, head)}…${hex.slice(-tail)}`;

export function eth(wei: string): string {
  const v = BigInt(wei);
  const unit = BigInt("1000000000000000000");
  const whole = v / unit;
  const frac = (v % unit).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return `${whole}${frac ? `.${frac}` : ""} ETH`;
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}
