/**
 * Limbo mark geometry (48×48): an eclipse.
 *
 * A teal planet (the waiting state), engraved with the same contour terrain as the hero,
 * and a vermilion hairline ring (the landed state) crossing in front of it. One section of
 * the ring has not formed yet: it fades away into fine dots. A dotted orbit frames both.
 *
 * Everything is seeded, so server and client render identical markup.
 */

export const PLANET = { cx: 19, cy: 27, r: 13 } as const;
export const RING = { cx: 29, cy: 21, r: 13 } as const;
export const ORBIT = { cx: 24, cy: 24, r: 22.5 } as const;

const f = (n: number) => Number(n.toFixed(3));
const rad = (deg: number) => (deg * Math.PI) / 180;

/** The section of the ring that fades into dots, in degrees (0 = 3 o'clock, clockwise). */
export const FADE_START = -125;
export const FADE_SPAN = 140;

export const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [f(cx + r * Math.cos(rad(a))), f(cy + r * Math.sin(rad(a)))];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};

/** The formed part of the ring: everything except the fading section. */
export const RING_SOLID = arc(RING.cx, RING.cy, RING.r, FADE_START + FADE_SPAN - 360, FADE_START);

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fine dots along the fading section: packed tight where the ring ends,
 * thinning, shrinking and loosening toward the far end until nothing is left.
 */
export const DOTS = (() => {
  const R = mulberry32(23);
  const out: { x: number; y: number; r: number; o: number; u: number }[] = [];
  for (let i = 0; i < 1100; i++) {
    const u = R();
    if (R() > Math.pow(1 - u, 2.6)) continue;
    const a = rad(FADE_START + u * FADE_SPAN);
    const g = (R() + R() - 1) * (0.12 + u * 0.55);
    const rr = RING.r + g;
    out.push({
      x: f(RING.cx + rr * Math.cos(a)),
      y: f(RING.cy + rr * Math.sin(a)),
      r: f(0.07 + 0.11 * (1 - u) * (0.6 + R() * 0.8)),
      o: f(0.2 + 0.8 * Math.pow(1 - u, 1.4)),
      u: f(u),
    });
  }
  return out.sort((a, b) => a.u - b.u);
})();

/** Three dots for the small mark: the same fade, reduced. Biggest nearest the ring's end. */
export const SMALL_DOTS = [
  { a: -30, r: 1.15 },
  { a: -12, r: 0.85 },
  { a: 4, r: 0.55 },
].map(({ a, r }) => ({ x: f(RING.cx + RING.r * Math.cos(rad(a))), y: f(RING.cy + RING.r * Math.sin(rad(a))), r }));

/** Where the small mark's solid ring stops, leaving room for its three dots. */
export const SMALL_RING = arc(RING.cx, RING.cy, RING.r, FADE_START + FADE_SPAN - 360, FADE_START + FADE_SPAN * 0.55);

export const SATELLITE_ANGLE = -28;
