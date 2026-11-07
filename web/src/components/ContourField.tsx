"use client";

import { useEffect, useState } from "react";
import { Circle, ContourLines, FractalNoise, Group, Shader, SolidColor } from "shaders/react";
import { useTheme } from "@/lib/theme";

const PALETTE = {
  dark: { bg: "#0e1517", line: "#7dc4ae73", accent: "#f2683cb3" },
  light: { bg: "#f1eee6", line: "#2e6f6080", accent: "#d9480fa6" },
} as const;

/**
 * Slow survey-plate terrain: teal contour lines with a few vermilion "routes".
 * `reveal` masks the field toward one side so copy laid over it stays clean.
 */
export function ContourField({
  reveal = "right",
  seed = 12,
  levels = 14,
  spread = 1.75,
}: {
  reveal?: "right" | "full";
  seed?: number;
  levels?: number;
  spread?: number;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const { bg, line, accent } = PALETTE[useTheme()];
  useEffect(() => setSupported("gpu" in navigator), []);

  if (supported === null) return null;
  if (!supported) return <div className="field__fallback" aria-hidden />;

  const noise = (
    <FractalNoise colorA="#000000" colorB="#ffffff" octaves={3} detail={2} contrast={0.45} speed={0.04} seed={seed} />
  );

  return (
    <Shader disableTelemetry onUnavailable={() => setSupported(false)} className="fill" aria-hidden>
      <SolidColor color={bg} />
      {reveal === "right" && (
        <Circle id="fieldMask" visible={false} color="#ffffff" radius={spread} softness={0.9} center={{ x: 1.05, y: 0.4 }} />
      )}
      <Group {...(reveal === "right" ? { maskSource: "fieldMask" } : {})}>
        <ContourLines
          levels={levels}
          lineWidth={1.25}
          softness={0.45}
          gamma={0.9}
          colorMode="custom"
          lineColor={line}
          backgroundColor="transparent"
        >
          {noise}
        </ContourLines>
        <ContourLines
          levels={3}
          lineWidth={1.5}
          softness={0.5}
          gamma={0.9}
          colorMode="custom"
          lineColor={accent}
          backgroundColor="transparent"
        >
          {noise}
        </ContourLines>
      </Group>
    </Shader>
  );
}
