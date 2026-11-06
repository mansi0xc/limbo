import { getCodeHash, getStake, readLatchDeadline, readLatchState } from "../chain.js";
import type { ChainReader } from "./types.js";

export const chainReader: ChainReader = {
  readCodeHash: getCodeHash,
  readStake: getStake,
  readLatchState,
  readLatchDeadline,
  now: async () => BigInt(Math.floor(Date.now() / 1000)),
};
