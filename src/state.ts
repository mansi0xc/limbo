import fs from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { config } from "./config.js";

export interface TrellisState {
  deployerKey?: Hex;
  ownerKey?: Hex;
  aliceKey?: Hex;
  bobKey?: Hex;
  oracleKey?: Hex;
  beneficiaryKey?: Hex;

  deployer?: Address;
  owner?: Address;
  alice?: Address;
  bob?: Address;
  oracle?: Address;
  beneficiary?: Address;

  rescueLatch?: Address;
  rescueAccount?: Address;
  rescueEventId?: Hex;
  rescueDeadline?: string;
  rescueExpiry?: string;
  rescueCodeHash?: Hex;
  rescueStakeTx?: Hex;
  rescuePingTx?: Hex;
  rescueTxHash?: Hex;
  rescueIncludedBlock?: string;
  rescueGas?: string;

  dlcLatch?: Address;
  dlcAccount?: Address;
  dlcEventId?: Hex;
  dlcDeadline?: string;
  dlcExpiry?: string;
  dlcCodeHash?: Hex;
  dlcStakeTx?: Hex;
  dlcOpenTx?: Hex;
  dlcAttestTx?: Hex;
  dlcAttestBlock?: string;
  dlcTxHash?: Hex;
  dlcIncludedBlock?: string;
  dlcGas?: string;
}

export type KeyName = "deployer" | "owner" | "alice" | "bob" | "oracle" | "beneficiary";

const KEY_FIELD: Record<KeyName, keyof TrellisState> = {
  deployer: "deployerKey",
  owner: "ownerKey",
  alice: "aliceKey",
  bob: "bobKey",
  oracle: "oracleKey",
  beneficiary: "beneficiaryKey",
};

const ADDRESS_FIELD: Record<KeyName, keyof TrellisState> = {
  deployer: "deployer",
  owner: "owner",
  alice: "alice",
  bob: "bob",
  oracle: "oracle",
  beneficiary: "beneficiary",
};

export function readState(): TrellisState {
  try {
    return JSON.parse(fs.readFileSync(config.stateFile, "utf8")) as TrellisState;
  } catch {
    return {};
  }
}

export function writeState(patch: Partial<TrellisState>): void {
  fs.writeFileSync(config.stateFile, JSON.stringify({ ...readState(), ...patch }, null, 2) + "\n");
}

export function ensureKey(name: KeyName): Hex {
  const field = KEY_FIELD[name];
  const existing = readState()[field] as Hex | undefined;
  if (existing) return existing;

  const env = name === "deployer" ? (process.env.TRELLIS_DEPLOYER_KEY as Hex | undefined) : undefined;
  const key = env ?? generatePrivateKey();
  const address = privateKeyToAccount(key).address;
  writeState({ [field]: key, [ADDRESS_FIELD[name]]: address } as Partial<TrellisState>);
  return key;
}

export function addressOf(key: Hex): Address {
  return privateKeyToAccount(key).address;
}

export function requireState<K extends keyof TrellisState>(key: K): NonNullable<TrellisState[K]> {
  const value = readState()[key];
  if (value == null) throw new Error(`missing ${String(key)} in ${config.stateFile}; run yarn deploy`);
  return value as NonNullable<TrellisState[K]>;
}
