import type { Address, Hex } from "viem";
import { toWire as libToWire } from "@forshtat/hegota-support/rpc";
import type { FrameTransaction, SignatureEntry } from "./types.js";

/** The JSON shape `eth_sendFrameTransaction` expects. */
export const toWire = libToWire;

const big = (value: string): bigint => BigInt(value);

/** Parses the sidecar wire shape back into the codec's transaction object. */
export function fromWire(wire: any): FrameTransaction {
  const signatures: SignatureEntry[] = (wire.signatures ?? []).map((s: any) => ({
    scheme: Number(s.scheme),
    signer: s.signer as Hex,
    msg: s.msg as Hex,
    signature: s.signature as Hex,
  }));

  return {
    chainId: big(wire.chainId),
    nonceKeys: (wire.nonceKeys ?? []).map(big),
    nonceSeq: big(wire.nonceSeq),
    sender: wire.sender as Address,
    frames: (wire.frames ?? []).map((f: any) => ({
      mode: Number(f.mode),
      flags: Number(f.flags),
      target: (f.target ?? null) as Address | null,
      limits: {
        execution: big(f.limits.execution),
        state: big(f.limits.state),
      },
      value: big(f.value),
      data: f.data as Hex,
    })),
    signatures,
    fees: {
      maxPriorityFeePerGas: big(wire.fees.maxPriorityFeePerGas),
      maxFeePerGas: big(wire.fees.maxFeePerGas),
      maxFeePerBlobGas: big(wire.fees.maxFeePerBlobGas),
    },
    blobVersionedHashes: (wire.blobVersionedHashes ?? []) as Hex[],
    recentRootReferences: (wire.recentRootReferences ?? []).map((r: any) => ({
      sourceId: r.sourceId as Hex,
      slot: big(r.slot),
      root: r.root as Hex,
    })),
  };
}
