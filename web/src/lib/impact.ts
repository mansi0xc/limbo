/** Who Limbo is for and what changes for them. Only the first two cases are built and demoed. */

export type UseCase = {
  id: string;
  title: string;
  status: "demoed" | "same-rule";
  who: string;
  today: string;
  limbo: string;
  trigger: string;
};

export const USE_CASES: UseCase[] = [
  {
    id: "inheritance",
    title: "Inheritance and dead man's switch",
    status: "demoed",
    who: "People who hold their own keys, and the family they leave behind.",
    today:
      "Share a seed phrase with someone, or trust a custodian or keeper service that can disappear, get hacked or change its mind.",
    limbo:
      "Sign the transfer to your heir once and keep checking in. If you go silent, anyone can trip the latch and that exact transfer lands. Nobody can redirect it.",
    trigger: "Heartbeat latch ends EXPIRED",
  },
  {
    id: "bets",
    title: "Peer-to-peer bets and prediction markets",
    status: "demoed",
    who: "Two people who disagree, and the markets built for them.",
    today: "Lock funds in a settlement contract and rely on someone to run the settlement once the result is known.",
    limbo:
      "Both sides sign every outcome up front. The oracle attests, the matching payout lands, and the others can never land.",
    trigger: "Oracle attests YES or NO",
  },
  {
    id: "insurance",
    title: "Parametric insurance",
    status: "same-rule",
    who: "Farmers, travellers and the pools that cover them.",
    today: "File a claim and wait, or depend on a bot watching an oracle to pay out.",
    limbo:
      "The pool pre-signs the payout against an event like low rainfall or a delayed flight. When the oracle attests, the payout lands with no claim and no bot.",
    trigger: "Oracle attests the insured event",
  },
  {
    id: "escrow",
    title: "Escrow and milestone payments",
    status: "same-rule",
    who: "Freelancers, grant programs and DAOs paying for delivered work.",
    today: "An escrow agent or a multisig has to come back and act after the work is delivered.",
    limbo:
      "The client signs the release and the refund on one nonce slot. Delivery attested: the release lands. Deadline missed: the refund lands. Never both.",
    trigger: "Delivery attested, or deadline expires",
  },
  {
    id: "scheduled",
    title: "Scheduled and post-dated payments",
    status: "same-rule",
    who: "Payroll, vesting and anyone who wants to pay on a date.",
    today: "Run an automation service, or remember to send it yourself.",
    limbo:
      "Sign today, against a latch with a fixed deadline. After the deadline anyone can call expire(), and the payment lands. No privileged operator.",
    trigger: "Fixed deadline passes",
  },
  {
    id: "governance",
    title: "Governance execution",
    status: "same-rule",
    who: "DAOs and their signers.",
    today: "A bot or a multisig executes the proposal once the vote closes.",
    limbo: "Execution is pre-signed against the vote result. When the result is attested, it lands, exactly as signed.",
    trigger: "Vote result attested",
  },
];

export const AUDIENCES = [
  {
    who: "People who hold their own keys",
    what: "Inheritance, recovery and conditional transfers without handing anyone a key or trusting a service.",
  },
  {
    who: "Wallet teams",
    what: "Scheduled, conditional and posthumous transfers from one account pattern, with no keeper infrastructure to run.",
  },
  {
    who: "Apps that run keepers today",
    what: "Prediction markets, insurance, escrow and DAO tools can drop their bespoke settlement bots.",
  },
  {
    who: "Node operators and researchers",
    what: "A written, testable mempool policy for the alternative mempool, with a reference implementation.",
  },
] as const;
