"use client";

import { Check } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import type { WorkoutPlanKind } from "@/lib/hiit";
import { cn } from "@/lib/utils";

const STEPS: WorkoutPlanKind[] = ["warmup", "strength", "stretch"];

function stepShortLabel(
  kind: WorkoutPlanKind,
  platform: ReturnType<typeof usePlatformCopy>
) {
  if (kind === "warmup") return platform.workout.sessionTypeWarmup;
  if (kind === "stretch") return platform.workout.sessionTypeStretch;
  return platform.workout.sessionTypeMain;
}

function normalizeStep(kind: string | null | undefined): WorkoutPlanKind {
  if (kind === "warmup") return "warmup";
  if (kind === "stretch") return "stretch";
  return "strength";
}

/** Warm-up → Main → Stretch — numbered steps with “Step X of 3”. */
export function DayFlowProgress({
  currentKind,
  className,
  variant = "light",
  compact = false,
}: {
  currentKind: string | null | undefined;
  className?: string;
  variant?: "light" | "dark";
  /** Smaller pills, no “Step X of 3” label. */
  compact?: boolean;
}) {
  const platform = usePlatformCopy();
  const current = normalizeStep(currentKind);
  const currentIndex = STEPS.indexOf(current);
  const currentLabel = stepShortLabel(current, platform);

  return (
    <div className={cn("w-full", compact ? "space-y-0" : "space-y-2", className)}>
      {!compact ? (
        <p
          className={cn(
            "text-center text-[11px] font-semibold",
            variant === "dark" ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {platform.workout.dayFlowStepOf(currentIndex + 1, STEPS.length)}
          <span className="mx-1.5 opacity-40">·</span>
          <span
            className={cn(
              "font-bold",
              variant === "dark" ? "text-white" : "text-foreground"
            )}
          >
            {currentLabel}
          </span>
        </p>
      ) : null}

      <ol className={cn("grid grid-cols-3", compact ? "gap-1" : "gap-1.5")}>
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const label = stepShortLabel(step, platform);
          return (
            <li key={step} className="min-w-0">
              <div
                className={cn(
                  "flex items-center transition-colors",
                  compact
                    ? "justify-center gap-1 rounded-lg border px-1.5 py-1"
                    : "gap-1.5 rounded-xl border px-2 py-1.5",
                  active &&
                    (variant === "dark"
                      ? "border-white/35 bg-white text-black shadow-sm"
                      : "border-primary/40 bg-primary text-primary-foreground shadow-sm"),
                  done &&
                    !active &&
                    (variant === "dark"
                      ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"),
                  !done &&
                    !active &&
                    (variant === "dark"
                      ? "border-white/10 bg-white/5 text-white/45"
                      : "border-border/60 bg-secondary/50 text-muted-foreground")
                )}
                aria-current={active ? "step" : undefined}
                aria-label={label}
                title={label}
              >
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-full font-black tabular-nums",
                    compact ? "h-4 w-4 text-[9px]" : "h-5 w-5 text-[10px]",
                    active &&
                      (variant === "dark" ? "bg-black/10" : "bg-white/20"),
                    done &&
                      !active &&
                      (variant === "dark" ? "bg-emerald-400/20" : "bg-emerald-500/20"),
                    !done &&
                      !active &&
                      (variant === "dark" ? "bg-white/10" : "bg-background/70")
                  )}
                >
                  {done ? (
                    <Check className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </span>
                {!compact ? (
                  <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wide">
                    {label}
                  </span>
                ) : (
                  <span className="min-w-0 truncate text-[9px] font-bold uppercase tracking-wide">
                    {label}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
