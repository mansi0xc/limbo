import fs from "node:fs";
import path from "node:path";
import { encodeDeployData, type Abi, type Address, type Hex } from "viem";
import { config } from "./config.js";
import { sendLegacy } from "./chain.js";
import { waitMined } from "./rpc.js";

export type ArtifactName = "Latch" | "RescueAccount" | "DLCAccount";

export interface Artifact {
  abi: Abi;
  bytecode: Hex;
}

export function loadArtifact(name: ArtifactName): Artifact {
  const file = path.resolve("contracts", "artifacts", `${name}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Artifact;
  } catch {
    throw new Error(`${file} is missing; run yarn build:contracts first`);
  }
}

export async function deployContract(
  name: ArtifactName,
  args: unknown[],
  value: bigint,
  key: Hex
): Promise<Address> {
  const { abi, bytecode } = loadArtifact(name);
  const data = encodeDeployData({ abi, bytecode, args });
  const hash = await sendLegacy(key, {
    to: null,
    data,
    value,
    gas: config.deployGasLimit,
  });
  const receipt = await waitMined(hash);
  if (receipt.status !== "0x1" || !receipt.contractAddress) {
    throw new Error(`${name} deployment ${hash} failed`);
  }
  return receipt.contractAddress as Address;
}

export {
  getCodeHash,
  getStake,
  readLatchState,
  readLatchDeadline,
  readBothFunded,
  readDeposit,
  sendLegacy,
} from "./chain.js";
