"use client";

import type { ReactNode } from "react";
import type { CompletionTone } from "@/lib/dashboard-task-enrichment";
import { cn } from "@/lib/utils";

export function DayCompletionRing({
  progress,
  tone,
  size,
  stroke,
  children,
  className,
}: {
  progress: number;
  tone: CompletionTone | "muted";
  size: number;
  stroke: number;
  children?: ReactNode;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);
  const strokeClass =
    tone === "green"
      ? "stroke-green-500"
      : tone === "amber"
        ? "stroke-amber-500"
        : tone === "red"
          ? "stroke-red-500"
          : "stroke-muted-foreground/30";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden={children ? undefined : true}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="pointer-events-none absolute inset-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted-foreground/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={strokeClass}
        />
      </svg>
      {children ? <span className="relative z-10">{children}</span> : null}
    </span>
  );
}
