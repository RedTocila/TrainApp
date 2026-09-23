"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { applyChatPlanPreviewAction } from "@/lib/actions/ai-plan-builder";
import type { ChatPlanPreview } from "@/lib/ai/coach-chat-tools";
import { isAiHiitPlan } from "@/lib/ai/plan-builder-types";
import { slotLabel } from "@/lib/meal-slots";
import { ExerciseGifThumbnail } from "@/components/exercise-gif-thumbnail";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { estimateHiitDurationSeconds, hiitSummaryLabel } from "@/lib/hiit";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describeSchedule(preview: ChatPlanPreview): string | null {
  const schedule = preview.schedule;
  if (!schedule) return null;
  const days =
    schedule.weekdays.length > 0
      ? schedule.weekdays.map((d) => WEEKDAY_SHORT[d] ?? "?").join(" ")
      : "default days";
  const weeks = schedule.weeks === 1 ? "1 wk" : `${schedule.weeks} wks`;
  return `${days} · ${weeks}`;
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-secondary/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
      {children}
    </span>
  );
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
  const [applyProgress, setApplyProgress] = useState(0);
  const [openDay, setOpenDay] = useState(0);
  const [showAbout, setShowAbout] = useState(false);
  const [showMoves, setShowMoves] = useState(true);
  const isWeeklyFull = preview.type === "weekly_full";
  const isWorkout = preview.type === "workout";
  const isNutrition = preview.type === "nutrition";
  const workoutPlan = isWorkout ? preview.plan : null;
  const hiitPlan = workoutPlan && isAiHiitPlan(workoutPlan) ? workoutPlan : null;
  const strengthPlan = workoutPlan && !isAiHiitPlan(workoutPlan) ? workoutPlan : null;
  const weeklyProgram = isWeeklyFull ? preview.program : null;
  const scheduleLabel = describeSchedule(preview);
  const isApplied = applied || localApplied;

  useEffect(() => {
    if (!isPending) {
      if (localApplied) setApplyProgress(100);
      else setApplyProgress(0);
      return;
    }

    setApplyProgress(10);
    const id = window.setInterval(() => {
      setApplyProgress((p) => {
        if (p >= 92) return p;
        const step = p < 35 ? 7 : p < 65 ? 4 : 1.5;
        return Math.min(92, p + step);
      });
    }, 320);

    return () => window.clearInterval(id);
  }, [isPending, localApplied]);

  const handleApply = () => {
    setError(null);
    setApplyProgress(8);
    startTransition(async () => {
      try {
        const result =
          preview.type === "weekly_full"
            ? await applyChatPlanPreviewAction(
                "weekly_full",
                preview.program,
                preview.schedule
              )
            : await applyChatPlanPreviewAction(
                preview.type,
                preview.plan,
                preview.schedule ?? { weeks: 4, weekdays: [] }
              );
        if ("error" in result) {
          setApplyProgress(0);
          setError(result.error);
          return;
        }
        setApplyProgress(100);
        setLocalApplied(true);
        setScheduledCount(result.scheduledCount);
        setShowMoves(false);
        setShowAbout(false);
        onApplied?.();
      } catch (err) {
        setApplyProgress(0);
        setError(
          err instanceof Error
            ? err.message
            : "Could not apply plan — try again or refresh the page."
        );
      }
    });
  };

  const title = isWeeklyFull ? preview.program.title : preview.plan.title;
  const description = isWeeklyFull
    ? preview.program.description
    : preview.plan.description;

  const typeLabel = hiitPlan
    ? "HIIT"
    : isWeeklyFull
      ? "Program"
      : isWorkout
        ? "Workout"
        : "Nutrition";

  const hiitMins = hiitPlan
    ? Math.max(1, Math.round(estimateHiitDurationSeconds(hiitPlan.config) / 60))
    : null;

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-background/80 p-3 text-center">
      <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
            {typeLabel}
          </p>
          <p className="mt-0.5 font-semibold leading-snug">{title}</p>

          <div className="mt-1.5 flex flex-wrap justify-center gap-1">
            {hiitPlan && hiitMins != null ? (
              <>
                <MetaChip>~{hiitMins} min</MetaChip>
                <MetaChip>
                  {hiitPlan.config.exercises.length} move
                  {hiitPlan.config.exercises.length === 1 ? "" : "s"}
                </MetaChip>
                <MetaChip>
                  {hiitPlan.config.rounds} round
                  {hiitPlan.config.rounds === 1 ? "" : "s"}
                </MetaChip>
                {hiitPlan.config.cycles > 1 ? (
                  <MetaChip>{hiitPlan.config.cycles} cycles</MetaChip>
                ) : null}
              </>
            ) : strengthPlan ? (
              <MetaChip>
                {strengthPlan.days.length} day
                {strengthPlan.days.length === 1 ? "" : "s"}
              </MetaChip>
            ) : weeklyProgram ? (
              <MetaChip>
                {weeklyProgram.days.length} day
                {weeklyProgram.days.length === 1 ? "" : "s"}
              </MetaChip>
            ) : isNutrition ? (
              <>
                <MetaChip>{preview.plan.daily_targets.calories} cal</MetaChip>
                <MetaChip>P{preview.plan.daily_targets.protein}</MetaChip>
                <MetaChip>C{preview.plan.daily_targets.carbs}</MetaChip>
                <MetaChip>F{preview.plan.daily_targets.fat}</MetaChip>
              </>
            ) : null}
            {scheduleLabel ? <MetaChip>{scheduleLabel}</MetaChip> : null}
            {weeklyProgram?.includeExtras ? (
              <MetaChip>WU + stretch</MetaChip>
            ) : null}
          </div>

          {description ? (
            <div className="mt-1.5">
              <button
                type="button"
                onClick={() => setShowAbout((v) => !v)}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                About
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    showAbout && "rotate-180"
                  )}
                />
              </button>
              {showAbout ? (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
          ) : null}

          {!isApplied || showMoves ? (
            hiitPlan ? (
              <div className="mt-2 text-left">
                {isApplied ? (
                  <button
                    type="button"
                    onClick={() => setShowMoves(false)}
                    className="mb-1.5 w-full text-center text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Hide moves
                  </button>
                ) : null}
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
                          {ex.work_seconds}s · {ex.rest_seconds}s rest
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : weeklyProgram ? (
              <div className="mt-2 space-y-1 text-left">
                {weeklyProgram.days.map((day, i) => {
                  const mainLabel =
                    day.main.kind === "strength"
                      ? `${day.main.workout.exercises.length} exercises`
                      : hiitSummaryLabel(day.main.plan.config);
                  return (
                    <div
                      key={i}
                      className="overflow-hidden rounded-lg border border-border/60"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenDay((current) => (current === i ? -1 : i))
                        }
                        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs"
                      >
                        <span>
                          <span className="font-medium text-foreground">
                            {day.focus}
                          </span>
                          {" · "}
                          {mainLabel}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                            openDay === i && "rotate-180"
                          )}
                        />
                      </button>
                      {openDay === i ? (
                        <div className="space-y-2 border-t border-border/60 px-2.5 py-2 text-xs">
                          {weeklyProgram.includeExtras && (
                            <p className="text-muted-foreground">
                              Warm-up: {day.warmup.title} (
                              {day.warmup.config.exercises.length} moves)
                            </p>
                          )}
                          {day.main.kind === "strength" ? (
                            <ul className="space-y-1.5">
                              {day.main.workout.exercises.map((ex) => (
                                <li
                                  key={`${day.focus}-${ex.name}`}
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
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-foreground">
                                      {ex.name}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {ex.sets} × {ex.reps}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground">
                              HIIT: {day.main.plan.title}
                            </p>
                          )}
                          {weeklyProgram.includeExtras && (
                            <p className="text-muted-foreground">
                              Stretch: {day.stretch.title} (
                              {day.stretch.config.exercises.length} moves)
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : strengthPlan ? (
              <div className="mt-2 space-y-1 text-left">
                {strengthPlan.days.map((day, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-lg border border-border/60"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDay((current) => (current === i ? -1 : i))
                      }
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs"
                    >
                      <span>
                        <span className="font-medium text-foreground">
                          {day.title}
                        </span>
                        {" · "}
                        {day.exercises.length} exercise
                        {day.exercises.length === 1 ? "" : "s"}
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
                              <p className="font-medium text-foreground">
                                {ex.name}
                              </p>
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
            ) : isNutrition ? (
              <ul className="mt-2 space-y-0.5 text-left text-xs text-muted-foreground">
                {preview.plan.meals.map((meal, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">
                      {slotLabel(meal.slot)}:
                    </span>{" "}
                    {meal.name}
                  </li>
                ))}
              </ul>
            ) : null
          ) : hiitPlan ? (
            <button
              type="button"
              onClick={() => setShowMoves(true)}
              className="mt-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              Show {hiitPlan.config.exercises.length} moves
            </button>
          ) : null}

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          <div className="mt-3 flex flex-col items-center gap-2">
            {isApplied ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-400">
                <Check className="h-3.5 w-3.5" />
                Applied
                {scheduledCount != null && scheduledCount > 0
                  ? ` · ${scheduledCount} scheduled`
                  : null}
              </span>
            ) : (
              <>
                <Button
                  size="sm"
                  className="h-9 min-w-[11rem] px-5"
                  disabled={isPending}
                  onClick={handleApply}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Applying… {Math.round(applyProgress)}%
                    </>
                  ) : scheduleLabel ? (
                    "Apply & schedule"
                  ) : (
                    "Apply to my program"
                  )}
                </Button>
                {isPending ? (
                  <div className="w-full max-w-[14rem] space-y-1">
                    <Progress value={applyProgress} className="h-1.5" />
                    <p className="text-center text-[10px] font-medium text-muted-foreground">
                      Saving & scheduling…
                    </p>
                  </div>
                ) : scheduleLabel ? (
                  <p className="text-center text-[11px] font-medium text-muted-foreground">
                    {scheduleLabel}
                  </p>
                ) : null}
              </>
            )}
          </div>
      </div>
    </div>
  );
}
