"use client";

import dynamic from "next/dynamic";

export const WeightChartLazy = dynamic(
  () => import("@/components/weight-chart").then((mod) => ({ default: mod.WeightChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] animate-pulse rounded-xl bg-secondary/30" aria-hidden />
    ),
  }
);
