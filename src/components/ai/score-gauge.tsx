"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScoreGauge({
  score,
  label,
  icon: Icon,
  colorClass = "text-primary",
  size = "md",
}: {
  score: number | null;
  label: string;
  icon?: LucideIcon;
  colorClass?: string;
  size?: "sm" | "md" | "lg";
}) {
  const reduce = useReducedMotion();
  const value = score ?? 0;
  const pct = Math.min(100, Math.max(0, value)) / 100;

  const dims = {
    sm: { box: "h-16 w-16", r: 34, stroke: 5, text: "text-base" },
    md: { box: "h-20 w-20", r: 38, stroke: 6, text: "text-xl" },
    lg: { box: "h-28 w-28", r: 48, stroke: 7, text: "text-3xl" },
  }[size];

  const circumference = 2 * Math.PI * dims.r;
  const offset = circumference - pct * circumference;
  const strokePad = dims.stroke / 2 + 2;
  const viewMin = 50 - dims.r - strokePad;
  const viewSize = 2 * (dims.r + strokePad);

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className={cn("relative shrink-0", dims.box)}>
        <svg
          className="h-full w-full -rotate-90"
          viewBox={`${viewMin} ${viewMin} ${viewSize} ${viewSize}`}
          overflow="visible"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r={dims.r}
            fill="none"
            stroke="currentColor"
            strokeWidth={dims.stroke}
            className="text-secondary/80"
          />
          <motion.circle
            cx="50"
            cy="50"
            r={dims.r}
            fill="none"
            stroke="currentColor"
            strokeWidth={dims.stroke}
            strokeLinecap="round"
            className={colorClass}
            strokeDasharray={circumference}
            initial={reduce ? false : { strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {Icon && size !== "sm" && <Icon className={cn("mb-0.5 h-3.5 w-3.5", colorClass)} />}
          <span className={cn("font-black leading-none", dims.text)}>
            {score ?? "—"}
          </span>
        </div>
      </div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
