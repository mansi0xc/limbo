"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { GitHub, Mark, Moon, Sun } from "./Icons";
import { REPO } from "@/lib/links";
import { setTheme, useTheme } from "@/lib/theme";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#impact", label: "Who it’s for" },
  { href: "/docs", label: "Docs" },
  { href: "/playground", label: "Playground" },
  { href: "/explorer", label: "Explorer" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const theme = useTheme();
  const path = usePathname();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const next = theme === "dark" ? "light" : "dark";

  return (
    <header className="nav" data-scrolled={scrolled}>
      <div className="wrap nav__in">
        <Link href="/" className="brand" aria-label="Limbo home">
          <Mark />
          Limbo
        </Link>
        <div className="nav__right">
          <nav className="nav__links" aria-label="Sections">
            {LINKS.map((l) => {
              const active = l.href === path;
              return (
                <Link key={l.href} href={l.href} className="nav__link" aria-current={active ? "page" : undefined}>
                  {l.label}
                  {active && <motion.span layoutId="nav-ink" className="nav__ink" />}
                </Link>
              );
            })}
          </nav>
          <button
            className="theme"
            onClick={() => setTheme(next)}
            aria-label={`Switch to ${next} theme`}
            title={`Switch to ${next} theme`}
          >
            <motion.span
              key={theme}
              initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: "grid" }}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </motion.span>
          </button>
          <a className="btn btn--line nav__gh" href={REPO} target="_blank" rel="noreferrer">
            <GitHub />
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
