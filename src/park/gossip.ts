import type { Trigger } from "./types.js";

/** Gossip one parked transaction to a peer. The peer runs the same admission checks. */
export async function gossip(peerUrl: string, body: { tx: unknown; trigger: Trigger }): Promise<any> {
  const response = await fetch(`${peerUrl}/park`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!text) return { ok: response.ok, status: response.status };
  try {
    return JSON.parse(text);
  } catch {
    return { ok: response.ok, status: response.status, body: text };
  }
}
