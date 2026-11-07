import { PLANET, SMALL_DOTS, SMALL_RING } from "@/lib/mark";

type P = { className?: string };

const base = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const ArrowUpRight = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 11 11 5M6 5h5v5" />
  </svg>
);

export const ArrowDown = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M8 3v10M4 9l4 4 4-4" />
  </svg>
);

export const ArrowRight = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

export const Dash = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M3 8h10" />
  </svg>
);

/**
 * Limbo mark, small: a shaded teal planet and a vermilion ring passing in front of it,
 * whose open end trails off in three dots. Crisp at 16–32px. The detailed version is ClosingMark.
 */
export const Mark = ({ className }: P) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
    <defs>
      <radialGradient id="limbo-planet" cx="0.66" cy="0.32" r="0.8">
        <stop offset="0" style={{ stopColor: "var(--tint)" }} />
        <stop offset="0.6" style={{ stopColor: "color-mix(in srgb, var(--tint) 78%, var(--paper))" }} />
        <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--tint) 38%, var(--paper))" }} />
      </radialGradient>
    </defs>
    <circle cx={PLANET.cx} cy={PLANET.cy} r={PLANET.r} fill="url(#limbo-planet)" />
    <path d={SMALL_RING} stroke="var(--paper)" strokeWidth={4.6} strokeLinecap="round" />
    <path d={SMALL_RING} stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" />
    {SMALL_DOTS.map((d) => (
      <circle key={d.x} cx={d.x} cy={d.y} r={d.r} fill="var(--accent)" />
    ))}
  </svg>
);

export const Sun = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
  </svg>
);

export const Moon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />
  </svg>
);

export const GitHub = ({ className }: P) => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
    <path d="M8 .2a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.71 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 .2Z" />
  </svg>
);
