import Link from "next/link";
import { Mark } from "./Icons";
import { REPO, RULE_DOC, RUNBOOK } from "@/lib/links";

export function Footer() {
  return (
    <footer className="wrap foot">
      <span className="foot__brand">
        <Mark />
        Limbo · built for the EF Frame Transaction Alt Mempool track, ETHGlobal Mumbai 2026
      </span>
      <span className="foot__links">
        <Link href="/docs">Docs</Link>
        <Link href="/playground">Playground</Link>
        <a href={REPO} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href={RULE_DOC} target="_blank" rel="noreferrer">
          Rule draft
        </a>
        <a href={RUNBOOK} target="_blank" rel="noreferrer">
          Runbook
        </a>
      </span>
    </footer>
  );
}
