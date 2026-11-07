"use client";

import { motion, MotionConfig, useInView } from "motion/react";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { DOTS, ORBIT, PLANET, RING, RING_SOLID, SATELLITE_ANGLE } from "@/lib/mark";
import { EASE } from "./Motion";

const PlanetShader = dynamic(() => import("./PlanetShader").then((m) => m.PlanetShader), { ssr: false });

/**
 * The Limbo mark at display size.
 * The planet is a live shader engraved with the hero's contour terrain; the ring, its fading
 * dots and the orbit are SVG hairlines laid over it. Assembles once when scrolled into view.
 */
export function ClosingMark() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.45 });
  const on = (v: number) => (inView ? v : 0);

  return (
    <MotionConfig reducedMotion="user">
      <div ref={ref} className="closing__mark mark-xl" aria-hidden>
        <motion.div
          className="mark-xl__planet"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: on(1), scale: inView ? 1 : 0.96 }}
          transition={{ duration: 1.6, ease: EASE }}
        >
          <PlanetShader />
        </motion.div>

        <svg viewBox="0 0 48 48" fill="none" className="mark-xl__svg">
          <motion.circle
            cx={ORBIT.cx}
            cy={ORBIT.cy}
            r={ORBIT.r}
            stroke="var(--tint)"
            strokeOpacity={0.45}
            strokeWidth={0.12}
            strokeDasharray="0.12 0.9"
            initial={{ opacity: 0 }}
            animate={{ opacity: on(1) }}
            transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}
          />
          <motion.g
            style={{ originX: `${ORBIT.cx}px`, originY: `${ORBIT.cy}px` }}
            initial={{ rotate: SATELLITE_ANGLE, opacity: 0 }}
            animate={inView ? { rotate: SATELLITE_ANGLE + 360, opacity: 1 } : undefined}
            transition={{ rotate: { duration: 120, ease: "linear", repeat: Infinity }, opacity: { duration: 1, delay: 2.4 } }}
          >
            <circle cx={ORBIT.cx + ORBIT.r} cy={ORBIT.cy} r={0.42} fill="var(--accent)" />
          </motion.g>

          <motion.circle
            cx={PLANET.cx}
            cy={PLANET.cy}
            r={PLANET.r}
            stroke="var(--tint)"
            strokeWidth={0.22}
            strokeOpacity={0.85}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: on(1) }}
            transition={{ duration: 1.6, ease: EASE, delay: 0.1 }}
          />
          <motion.path
            d={RING_SOLID}
            stroke="var(--paper)"
            strokeWidth={1.1}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: on(1) }}
            transition={{ duration: 1.8, ease: EASE, delay: 0.6 }}
          />
          <motion.path
            d={RING_SOLID}
            stroke="var(--accent)"
            strokeWidth={0.32}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: on(1) }}
            transition={{ duration: 1.8, ease: EASE, delay: 0.6 }}
          />
          <motion.circle
            cx={RING.cx}
            cy={RING.cy}
            r={RING.r - 0.9}
            stroke="var(--accent)"
            strokeWidth={0.1}
            strokeOpacity={0.45}
            initial={{ opacity: 0 }}
            animate={{ opacity: on(1) }}
            transition={{ duration: 1.2, delay: 1.6 }}
          />

          {DOTS.map((d, i) => (
            <motion.circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={d.r}
              fill="var(--accent)"
              initial={{ opacity: 0 }}
              animate={{ opacity: on(d.o) }}
              transition={{ duration: 0.6, delay: 2.2 + d.u * 1.4 }}
            />
          ))}
        </svg>
      </div>
    </MotionConfig>
  );
}
