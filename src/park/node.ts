import http from "node:http";
import path from "node:path";
import { isAddressEqual, type Address, type Hex } from "viem";
import { config } from "../config.js";
import { fromWire } from "../frameTx/wire.js";
import { FRAME_MODE } from "../frameTx/types.js";
import { readState } from "../state.js";
import { validate } from "./admission.js";
import { gossip } from "./gossip.js";
import { ParkIndexer } from "./indexer.js";
import { chainReader } from "./reader.js";
import { ParkStore } from "./store.js";
import { templatesFromState } from "./templates.js";
import type { ParkedEntry, Trigger } from "./types.js";

type Role = "a" | "b";

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function view(entry: ParkedEntry) {
  return {
    id: entry.id,
    kind: entry.kind,
    sender: entry.sender,
    trigger: entry.trigger,
    status: entry.status,
    expiry: entry.expiry.toString(),
    signers: entry.signers,
    txHash: entry.txHash,
    gasUsed: entry.gasUsed?.toString(),
    includedBlock: entry.includedBlock?.toString(),
    error: entry.error,
    txId: entry.txId,
    attempts: entry.attempts,
    nextAttemptAt: entry.nextAttemptAt,
    nonceKey: entry.nonceKey.toString(),
    nonceSeq: entry.nonceSeq.toString(),
    payouts: (entry.tx.frames ?? [])
      .filter((frame) => frame.mode === FRAME_MODE.SENDER && frame.value > 0n)
      .map((frame) => ({ to: frame.target, value: frame.value.toString() })),
    receivedAt: entry.receivedAt,
  };
}

interface LatchView {
  kind: string;
  account: Address;
  latch: Address;
  eventId: Hex;
  state: number | null;
  deadline: string | null;
  readAt: number | null;
  error?: string;
}

/** A malformed request: answered with 400, not 500. */
class BadRequest extends Error {}

async function readBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 2 * 1024 * 1024) throw new BadRequest("body too large");
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new BadRequest("body is not JSON");
  }
}

function send(res: http.ServerResponse, status: number, body: unknown, readOnly = false): void {
  const text = JSON.stringify(body);
  const headers: http.OutgoingHttpHeaders = {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(text),
  };
  // The read-only endpoints may be read by the park explorer from another origin. POST /park stays
  // same-origin: a browser cannot preflight it, so no web page can submit through a local node.
  if (readOnly) headers["access-control-allow-origin"] = "*";
  res.writeHead(status, headers);
  res.end(text);
}

const role: Role = (argValue("--config") as Role | undefined) ?? "a";
const port = role === "a" ? config.ports.a : config.ports.b;
const peer = role === "a" ? `http://127.0.0.1:${config.ports.b}` : undefined;

const state = readState();
const templates = templatesFromState(state);
const store = new ParkStore({ file: path.join(config.parkDir, `${role}.json`) });
const indexer = new ParkIndexer(store, templates, chainReader, {
  primary: role === "a",
  fallbackAfterMs: config.fallbackPromoteMs,
});

/** The latch each template waits on, refreshed in the background for the explorer. */
const latches = new Map<string, LatchView>(
  templates.map((template) => [
    template.kind,
    {
      kind: template.kind,
      account: template.account,
      latch: template.latch,
      eventId: template.eventId,
      state: null,
      deadline: null,
      readAt: null,
    },
  ])
);

async function refreshLatches(): Promise<void> {
  for (const template of templates) {
    const current = latches.get(template.kind)!;
    try {
      const [latchState, deadline] = await Promise.all([
        chainReader.readLatchState(template.latch, template.eventId),
        chainReader.readLatchDeadline(template.latch, template.eventId),
      ]);
      latches.set(template.kind, { ...current, state: latchState, deadline: deadline.toString(), readAt: Date.now(), error: undefined });
    } catch (error) {
      latches.set(template.kind, { ...current, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return send(res, 200, { ok: true, role, port }, true);
    }

    if (req.method === "GET" && req.url === "/status") {
      return send(res, 200, {
        role,
        peer,
        now: Date.now(),
        promotion: indexer.snapshot(),
        latches: [...latches.values()],
        caps: { perTrigger: config.pCap, perEntity: config.eCap },
        entries: store.list().map(view),
        counts: {
          parked: store.list("parked").length,
          promoted: store.list("promoted").length,
          evicted: store.list("evicted").length,
          failed: store.list("failed").length,
        },
      }, true);
    }

    if (req.method === "POST" && req.url === "/park") {
      const body = await readBody(req);
      const trigger = body.trigger as Trigger;
      if (!body.tx || !trigger) return send(res, 400, { ok: false, rule: "PARK-010", reason: "missing tx or trigger" });

      let tx;
      try {
        tx = fromWire(body.tx);
      } catch (error) {
        throw new BadRequest(`tx is not a frame transaction: ${error instanceof Error ? error.message : String(error)}`);
      }
      const local = await validate(tx, trigger, templates, store, chainReader);

      // The local verdict stands on its own: an unreachable peer is reported, not turned into a 500.
      let peerResult: unknown;
      if (local.ok && peer) {
        try {
          peerResult = await gossip(peer, { tx: body.tx, trigger });
        } catch (error) {
          peerResult = {
            ok: false,
            rule: "PARK-080",
            reason: `peer unreachable: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }

      return send(res, local.ok ? 200 : 400, {
        ...local,
        entryId: local.entry?.id,
        entry: local.entry ? view(local.entry) : undefined,
        peer: peerResult,
      });
    }

    return send(res, 404, { ok: false, rule: "PARK-404", reason: "not found" });
  } catch (error) {
    if (error instanceof BadRequest) {
      return send(res, 400, { ok: false, rule: "PARK-400", reason: error.message });
    }
    return send(res, 500, {
      ok: false,
      rule: "PARK-500",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`limbo park node ${role} listening on http://127.0.0.1:${port}`);
  console.log(`templates: ${templates.map((template) => `${template.kind}=${template.account}`).join(", ")}`);
  if (peer) console.log(`gossip peer: ${peer}`);
  console.log(`store: ${store.list().length} entries loaded from ${config.parkDir}`);
  if (role !== "a") console.log(`fallback promoter after ${config.fallbackPromoteMs}ms`);
  indexer.start();
  void refreshLatches();
  latchTimer = setInterval(() => void refreshLatches(), 2000);
});

let latchTimer: NodeJS.Timeout | undefined;

function shutdown(): void {
  indexer.stop();
  if (latchTimer) clearInterval(latchTimer);
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
