import type { Hex } from "viem";
import * as lib from "@forshtat/hegota-support/tx";
import { profile } from "./profile.js";
import type { FrameTransaction } from "./types.js";

export const computeSigHash = (tx: FrameTransaction): Hex => lib.sigHash(profile, tx);

/** `0x06 || rlp(payload)`: the canonical wire bytes, what `eth_sendRawTransaction` takes. */
export const encodeRawFrameTx = (tx: FrameTransaction): Hex => lib.encodeTx(profile, tx);

/** Inverse of `encodeRawFrameTx`. */
export const decodeFrameTx = (raw: Hex): FrameTransaction => lib.decodeTx(profile, raw);
