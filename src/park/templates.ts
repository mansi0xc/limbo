import type { Address, Hex } from "viem";
import { config } from "../config.js";
import type { LimboState } from "../state.js";
import type { Template } from "./types.js";

export function templatesFromState(state: LimboState): Template[] {
  const required = (value: string | undefined, name: string): string => {
    if (!value) throw new Error(`missing ${name} in .limbo-state.json; run yarn deploy`);
    return value;
  };

  const rescue: Template = {
    kind: "rescue",
    account: required(state.rescueAccount, "rescueAccount") as Address,
    codeHash: required(state.rescueCodeHash, "rescueCodeHash") as Hex,
    latch: required(state.rescueLatch, "rescueLatch") as Address,
    eventId: required(state.rescueEventId, "rescueEventId") as Hex,
    allowedTags: [3],
    signers: [required(state.owner, "owner") as Address],
  };

  const dlc: Template = {
    kind: "dlc",
    account: required(state.dlcAccount, "dlcAccount") as Address,
    codeHash: required(state.dlcCodeHash, "dlcCodeHash") as Hex,
    latch: required(state.dlcLatch, "dlcLatch") as Address,
    eventId: required(state.dlcEventId, "dlcEventId") as Hex,
    allowedTags: [1, 2, 3],
    signers: [required(state.alice, "alice") as Address, required(state.bob, "bob") as Address],
  };

  return [rescue, dlc];
}

export { config };
