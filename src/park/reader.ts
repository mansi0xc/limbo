import { getCodeHash, getStake, readLatchDeadline, readLatchGrace, readLatchState } from "../chain.js";
import type { ChainReader } from "./types.js";

export const chainReader: ChainReader = {
  readCodeHash: getCodeHash,
  readStake: getStake,
  readLatchState,
  readLatchDeadline,
  readLatchGrace,
  now: async () => BigInt(Math.floor(Date.now() / 1000)),
};
