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
}: {
  currentKind: string | null | undefined;
  className?: string;
  variant?: "light" | "dark";
}) {
  const platform = usePlatformCopy();
  const current = normalizeStep(currentKind);
  const currentIndex = STEPS.indexOf(current);
  const currentLabel = stepShortLabel(current, platform);

  return (
    <div className={cn("w-full space-y-2", className)}>
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

      <ol className="grid grid-cols-3 gap-2">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const label = stepShortLabel(step, platform);
          return (
            <li key={step} className="min-w-0">
              <div
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-2 transition-colors",
                  active &&
                    (variant === "dark"
                      ? "border-white/40 bg-white text-black shadow-sm"
                      : "border-primary/40 bg-primary text-primary-foreground shadow-sm"),
                  done &&
                    !active &&
                    (variant === "dark"
                      ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                      : "border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"),
                  !done &&
                    !active &&
                    (variant === "dark"
                      ? "border-white/10 bg-white/5 text-white/45"
                      : "border-border/70 bg-secondary/60 text-muted-foreground")
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black tabular-nums",
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
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <span className="w-full truncate text-center text-[10px] font-bold uppercase tracking-wide">
                  {label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
