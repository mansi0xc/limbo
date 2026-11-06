import path from "node:path";
import { parseEther, parseGwei, type Address } from "viem";

export const config = {
  chainId: 1337,
  gatewayUrl: "https://altmempoolgateway.forshtat.com/rpc",
  rootUrl: "https://altmempool.forshtat.com",
  explorerUrl: "https://explorer.altmempool.wtf/",

  stakingRegistry: "0xd51c04d7a0b01124e84de152f4e56d9eecb22d2f" as Address,
  expiryVerifier: "0x81413f0cF12e9b6a49B1D0439E081c577D57FfFf" as Address,

  stateFile: path.resolve(".trellis-state.json"),

  stake: parseEther("0.012"),
  unstakeDelay: 86400,
  minStake: parseEther("0.01"),

  maxFeePerGas: parseGwei("2"),
  legacyGasPrice: parseGwei("0.002"),
  legacyGasLimit: 250_000n,
  deployGasLimit: 6_000_000n,
  txTimeoutSec: 180,

  pCap: 4,
  eCap: 8,

  ports: { a: 8787, b: 8788 },

  rescue: {
    amount: parseEther("0.02"),
    gasBuffer: parseEther("0.002"),
    interval: 60n,
    grace: 10n,
  },

  dlc: {
    deposit: parseEther("0.1"),
    payoutA: parseEther("0.099"),
    payoutB: parseEther("0.099"),
    gasBuffer: parseEther("0.002"),
    deadlineSeconds: 180n,
    grace: 10n,
  },

  chequeExpirySeconds: 900n,
} as const;

export type Config = typeof config;
