"use client";

import { useEffect, useState } from "react";
import { Circle, ContourLines, FractalNoise, Group, RadialGradient, Shader, SolidColor } from "shaders/react";
import { PLANET } from "@/lib/mark";
import { useTheme } from "@/lib/theme";

const PALETTE = {
  dark: { body: "#7dc4ae1f", line: "#7dc4aee6", shade: "#0e1517", shadeAlpha: "e6", rim: "#7dc4ae" },
  light: { body: "#2e6f6014", line: "#2e6f60e6", shade: "#f1eee6", shadeAlpha: "8c", rim: "#2e6f60" },
} as const;

/**
 * The planet: the hero's contour terrain engraved onto a sphere.
 * Masked to the planet's circle; a radial falloff shades the far side so it reads as a body, not a disc.
 */
export function PlanetShader() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const c = PALETTE[useTheme()];
  useEffect(() => setSupported("gpu" in navigator), []);

  const center = { x: PLANET.cx / 48, y: PLANET.cy / 48 };
  const radius = PLANET.r / 24;

  if (supported === null) return null;
  if (!supported) {
    return (
      <svg viewBox="0 0 48 48" className="fill" aria-hidden>
        <circle cx={PLANET.cx} cy={PLANET.cy} r={PLANET.r} fill={c.body} stroke={c.rim} strokeWidth={0.3} />
      </svg>
    );
  }

  return (
    <Shader disableTelemetry onUnavailable={() => setSupported(false)} className="fill">
      <Circle id="planet" visible={false} color="#ffffff" radius={radius} softness={0.004} center={center} />
      <Group maskSource="planet">
        <SolidColor color={c.body} />
        <ContourLines
          levels={15}
          lineWidth={1.2}
          softness={0.4}
          gamma={0.9}
          colorMode="custom"
          lineColor={c.line}
          backgroundColor="transparent"
        >
          <FractalNoise colorA="#000000" colorB="#ffffff" octaves={3} detail={2} contrast={0.42} speed={0.025} seed={5} />
        </ContourLines>
        <RadialGradient
          colorA={`${c.shade}00`}
          colorB={`${c.shade}${c.shadeAlpha}`}
          center={{ x: center.x + 0.09, y: center.y - 0.1 }}
          radius={radius * 1.6}
        />
      </Group>
    </Shader>
  );
}
