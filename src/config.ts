import path from "node:path";
import { parseEther, parseGwei, type Address } from "viem";

export const config = {
  chainId: 1337,
  gatewayUrl: "https://altmempoolgateway.forshtat.com/rpc",
  rootUrl: "https://altmempool.forshtat.com",
  explorerUrl: "https://explorer.altmempool.wtf/",

  stakingRegistry: "0xd51c04d7a0b01124e84de152f4e56d9eecb22d2f" as Address,
  expiryVerifier: "0x0000000000000000000000000000000000008141" as Address,

  stateFile: path.resolve(".trellis-state.json"),

  stake: parseEther("0.012"),
  unstakeDelay: 86400,
  minStake: parseEther("0.01"),

  maxFeePerGas: parseGwei("2"),
  legacyGasPrice: parseGwei("2"),
  legacyGasLimit: 250_000n,
  deployGasLimit: 20_000_000n,
  txTimeoutSec: 180,

  pCap: 4,
  eCap: 8,

  ports: { a: 8787, b: 8788 },
  /** Node B promotes a still-parked matching entry this long after it saw the latch settle. */
  fallbackPromoteMs: 30_000,
  /** Where each park node persists its store. */
  parkDir: path.resolve(".park"),

  rescue: {
    amount: parseEther("0.02"),
    gasBuffer: parseEther("0.002"),
    interval: 60n,
    grace: 10n,
    /**
     * How long after the latch deadline the balance stays reserved for the rescue. It covers the grace
     * period plus the cheque expiry (`chequeExpirySeconds`) plus a margin, so the owner can withdraw only
     * once every parked rescue cheque is dead.
     */
    window: 10n + 3600n + 300n,
  },

  dlc: {
    deposit: parseEther("0.1"),
    payoutA: parseEther("0.099"),
    payoutB: parseEther("0.099"),
    gasBuffer: parseEther("0.002"),
    deadlineSeconds: 900n,
    grace: 10n,
  },

  chequeExpirySeconds: 3600n,
} as const;

export type Config = typeof config;
