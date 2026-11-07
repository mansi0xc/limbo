"use client";

import dynamic from "next/dynamic";

export const ContourFieldClient = dynamic(() => import("./ContourField").then((m) => m.ContourField), {
  ssr: false,
});
