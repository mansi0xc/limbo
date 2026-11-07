"use client";

import { useState } from "react";

type Cmd = { cmd: string; note: string };

const GROUPS: { title: string; cmds: Cmd[] }[] = [
  {
    title: "# build and test",
    cmds: [
      { cmd: "git clone https://github.com/mansi0xc/trellis-vc && cd trellis-vc", note: "Node 20.12+, Yarn 1.22, Foundry" },
      { cmd: "yarn install --ignore-optional && yarn build:contracts", note: "compile the latch and accounts" },
      { cmd: "yarn test:contracts && yarn test", note: "Foundry and Vitest suites" },
    ],
  },
  {
    title: "# deploy to the devnet (chain 1337)",
    cmds: [{ cmd: "TRELLIS_DEPLOYER_KEY=0x… yarn deploy", note: "stakes and funds both accounts" }],
  },
  {
    title: "# two park nodes, then the workloads",
    cmds: [
      { cmd: "yarn park:a", note: "promoter · terminal 1" },
      { cmd: "yarn park:b", note: "peer, revalidates gossip · terminal 2" },
      { cmd: "yarn demo:deadman && yarn demo:dlc && yarn demo:cap", note: "rescue, DLC, and the P+1 cap" },
    ],
  },
];

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="copy"
      data-done={done}
      aria-label={`Copy: ${text}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard blocked; leave the command selectable */
        }
      }}
    >
      {done ? "copied" : "copy"}
    </button>
  );
}

export function Terminal() {
  return (
    <div className="term">
      <div className="term__bar">
        <span>trellis-vc</span>
        <span>devnet · chain 1337</span>
      </div>
      <div className="term__body">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="term__group">{g.title}</div>
            {g.cmds.map((c) => (
              <div className="cmd" key={c.cmd}>
                <div>
                  <code>{c.cmd}</code>
                  <small>{c.note}</small>
                </div>
                <CopyBtn text={c.cmd} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
