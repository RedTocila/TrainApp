"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MacroRing({
  value,
  target,
  label,
  sublabel,
  icon: Icon,
  accentClass = "text-primary",
  ringClass = "text-primary",
  size = "md",
  onClick,
  showRemaining = true,
  unit,
  exceededTolerance = false,
}: {
  value: number;
  target: number;
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  accentClass?: string;
  ringClass?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  /** When false, shows consumed value (e.g. tasks done) instead of remaining */
  showRemaining?: boolean;
  /** Shown inline next to the amount (e.g. ml, kg) */
  unit?: string;
  /** Over target and past the daily recovery band — show as failed, not in progress */
  exceededTolerance?: boolean;
}) {
  const reduce = useReducedMotion();
  const consumed = target > 0 ? Math.min(value / target, 1) : 0;
  const remaining = Math.max(0, target - value);
  const over = target > 0 && value > target;
  const failedOver = over && exceededTolerance;

  const dims = {
    sm: { box: "h-[4.5rem] w-[4.5rem]", r: 36, stroke: 5, icon: "h-4 w-4", value: "text-base" },
    md: { box: "h-[5.5rem] w-[5.5rem]", r: 42, stroke: 6, icon: "h-5 w-5", value: "text-lg" },
    lg: { box: "h-28 w-28", r: 50, stroke: 7, icon: "h-7 w-7", value: "text-3xl" },
  }[size];

  const circumference = 2 * Math.PI * dims.r;
  const offset = circumference - consumed * circumference;

  const displayAmount = showRemaining ? (over ? value - target : remaining) : value;
  const displaySuffix =
    unit
      ? ` ${unit}`
      : !showRemaining && target > 0 && size !== "lg"
        ? `/${target}`
        : showRemaining && size === "sm" && !label.includes("Cal")
          ? "g"
          : "";
  const displayLabel = over
    ? `${label} over`
    : showRemaining
      ? `${label} left`
      : label;

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 text-center",
        onClick && "rounded-xl transition-opacity hover:opacity-90 active:scale-[0.98]"
      )}
    >
      <div className={cn("relative shrink-0", dims.box)}>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
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
            className={cn(
              ringClass,
              failedOver ? "text-red-500" : over && "text-amber-500"
            )}
            strokeDasharray={circumference}
            initial={reduce ? false : { strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "flex items-center justify-center rounded-full bg-secondary/60",
              size === "lg" ? "h-14 w-14" : size === "md" ? "h-10 w-10" : "h-8 w-8"
            )}
          >
            <Icon className={cn(dims.icon, accentClass)} />
          </div>
        </div>
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className={cn("font-black leading-none tracking-tight", dims.value, failedOver ? "text-red-400" : over && "text-amber-400")}>
          {displayAmount}
          {displaySuffix && (
            <span className="text-[10px] font-semibold text-muted-foreground">
              {displaySuffix}
            </span>
          )}
        </p>
        <p className="text-[11px] font-medium leading-tight text-muted-foreground">
          {displayLabel}
        </p>
        {sublabel && !unit && (
          <p className="text-[10px] text-muted-foreground/80">{sublabel}</p>
        )}
      </div>
    </Wrapper>
  );
}
