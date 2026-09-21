"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ChevronDown, Dumbbell, Loader2, Salad, Zap } from "lucide-react";
import { applyChatPlanPreviewAction } from "@/lib/actions/ai-plan-builder";
import type { ChatPlanPreview } from "@/lib/ai/coach-chat-tools";
import { isAiHiitPlan } from "@/lib/ai/plan-builder-types";
import { slotLabel } from "@/lib/meal-slots";
import { ExerciseGifThumbnail } from "@/components/exercise-gif-thumbnail";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hiitSummaryLabel } from "@/lib/hiit";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describeSchedule(preview: ChatPlanPreview): string | null {
  const schedule = preview.schedule;
  if (!schedule) return null;
  const days =
    schedule.weekdays.length > 0
      ? schedule.weekdays.map((d) => WEEKDAY_SHORT[d] ?? "?").join("/")
      : "default days";
  return `${schedule.weeks} week(s) · ${days}`;
}

export function ChatPlanPreviewCard({
  preview,
  applied,
  onApplied,
  gender,
}: {
  preview: ChatPlanPreview;
  applied?: boolean;
  onApplied?: () => void;
  gender?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [localApplied, setLocalApplied] = useState(false);
  const [scheduledCount, setScheduledCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [openDay, setOpenDay] = useState(0);
  const isWorkout = preview.type === "workout";
  const workoutPlan = isWorkout ? preview.plan : null;
  const hiitPlan = workoutPlan && isAiHiitPlan(workoutPlan) ? workoutPlan : null;
  const strengthPlan = workoutPlan && !isAiHiitPlan(workoutPlan) ? workoutPlan : null;
  const scheduleLabel = describeSchedule(preview);
  const isApplied = applied || localApplied;

  const handleApply = () => {
    setError(null);
    startTransition(async () => {
      const result = await applyChatPlanPreviewAction(
        preview.type,
        preview.plan,
        preview.schedule ?? { weeks: 4, weekdays: [] }
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setLocalApplied(true);
      setScheduledCount(result.scheduledCount);
      onApplied?.();
    });
  };

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-background/80 p-3">
      <div className="flex items-start gap-2">
        {hiitPlan ? (
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-400" />
        ) : isWorkout ? (
          <Dumbbell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        ) : (
          <Salad className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {hiitPlan
              ? "HIIT workout preview"
              : isWorkout
                ? "Workout plan preview"
                : "Nutrition plan preview"}
          </p>
          <p className="mt-0.5 font-semibold">{preview.plan.title}</p>
          {preview.plan.description && (
            <p className="mt-1 text-xs text-muted-foreground">{preview.plan.description}</p>
          )}
          {scheduleLabel && (
            <p className="mt-1 text-[11px] font-medium text-emerald-400/90">
              Apply will save + schedule: {scheduleLabel}
            </p>
          )}

          {hiitPlan ? (
            <div className="mt-2 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground">
                {hiitSummaryLabel(hiitPlan.config)}
              </p>
              <ul className="space-y-1.5">
                {hiitPlan.config.exercises.map((ex) => (
                  <li
                    key={ex.name}
                    className="flex items-start gap-2 rounded-md bg-secondary/30 px-2 py-1.5"
                  >
                    <ExerciseGifThumbnail
                      name={ex.name}
                      imageUrl={ex.image_url}
                      videoUrl={ex.video_url}
                      gender={gender}
                      size="sm"
                      expandable
                    />
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-medium text-foreground">{ex.name}</p>
                      <p className="text-muted-foreground">
                        {ex.work_seconds}s work · {ex.rest_seconds}s rest
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : strengthPlan ? (
            <div className="mt-2 space-y-1">
              {strengthPlan.days.map((day, i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-border/60">
                  <button
                    type="button"
                    onClick={() => setOpenDay((current) => (current === i ? -1 : i))}
                    className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs"
                  >
                    <span>
                      <span className="font-medium text-foreground">{day.title}</span>
                      {" — "}
                      {day.exercises.length} exercise{day.exercises.length === 1 ? "" : "s"}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                        openDay === i && "rotate-180"
                      )}
                    />
                  </button>
                  {openDay === i && day.exercises.length > 0 ? (
                    <ul className="space-y-1.5 border-t border-border/60 px-2.5 py-2">
                      {day.exercises.map((ex) => (
                        <li
                          key={`${day.title}-${ex.name}`}
                          className="flex items-start gap-2 rounded-md bg-secondary/30 px-2 py-1.5"
                        >
                          <ExerciseGifThumbnail
                            name={ex.name}
                            imageUrl={ex.image_url}
                            videoUrl={ex.video_url}
                            gender={gender}
                            size="sm"
                            expandable
                          />
                          <div className="min-w-0 flex-1 text-xs">
                            <p className="font-medium text-foreground">{ex.name}</p>
                            <p className="text-muted-foreground">
                              {ex.sets} × {ex.reps}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ) : preview.type === "nutrition" ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold">
                  {preview.plan.daily_targets.calories} cal
                </span>
                <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold">
                  P{preview.plan.daily_targets.protein}
                </span>
                <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold">
                  C{preview.plan.daily_targets.carbs}
                </span>
                <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold">
                  F{preview.plan.daily_targets.fat}
                </span>
              </div>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {preview.plan.meals.map((meal, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">{slotLabel(meal.slot)}:</span>{" "}
                    {meal.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isApplied ? (
              <span className="inline-flex flex-col gap-0.5 text-xs font-semibold text-green-400">
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" />
                  Applied to your program
                </span>
                {scheduledCount != null && scheduledCount > 0 ? (
                  <span className="font-medium text-emerald-300/90">
                    Scheduled {scheduledCount} session
                    {scheduledCount === 1 ? "" : "s"} on your calendar
                  </span>
                ) : null}
              </span>
            ) : (
              <Button size="sm" className="h-8" disabled={isPending} onClick={handleApply}>
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Applying…
                  </>
                ) : scheduleLabel ? (
                  "Apply & schedule"
                ) : (
                  "Apply to my program"
                )}
              </Button>
            )}
            <Link
              href={isWorkout ? "/dashboard/workout" : "/dashboard/nutrition"}
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              Open calendar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
