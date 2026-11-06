import { concat, keccak256, numberToHex, pad, type Address, type Hex } from "viem";
import { profile } from "./profile.js";

export const NONCE_MANAGER = profile.predeploys!.NONCE_MANAGER as Address;
export const RECENT_ROOT_ADDRESS = profile.predeploys!.RECENT_ROOT_ADDRESS as Address;

/** Where `NONCE_MANAGER` keeps the next `nonce_seq` of `(sender, key)`. */
export const keyedNonceSlot = (sender: Address, key: bigint): Hex =>
  keccak256(concat([pad(sender, { size: 32 }), numberToHex(key, { size: 32 })]));
