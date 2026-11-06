import { profile } from "./profile.js";

export type { Frame, FrameTx as FrameTransaction, SignatureEntry } from "@forshtat/hegota-support/tx";

export const FRAME_MODE = profile.frameModes as {
  readonly DEFAULT: number;
  readonly VERIFY: number;
  readonly SENDER: number;
};
