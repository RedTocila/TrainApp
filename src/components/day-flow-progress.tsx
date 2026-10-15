"use client";

import { ChevronRight } from "lucide-react";
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

/** Warm-up → Main → Stretch, with an arrow between each step. */
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

      <ol className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const label = stepShortLabel(step, platform);
          return (
            <li key={step} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    variant === "dark" ? "text-white/45" : "text-muted-foreground"
                  )}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "whitespace-nowrap font-bold uppercase tracking-wide",
                  compact ? "text-[11px]" : "text-xs",
                  active &&
                    (variant === "dark" ? "text-white" : "text-primary"),
                  done &&
                    !active &&
                    (variant === "dark" ? "text-white/80" : "text-foreground"),
                  !done &&
                    !active &&
                    (variant === "dark" ? "text-white/45" : "text-muted-foreground")
                )}
                aria-current={active ? "step" : undefined}
              >
                {index + 1} {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
