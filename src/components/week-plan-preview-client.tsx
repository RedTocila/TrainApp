"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deletePersonalWorkoutPlan,
  schedulePersonalWeekPlan,
  type WeekPlanPreviewWorkout,
  type PersonalWeekPlanListItem,
} from "@/lib/actions/user-workouts";
import { AppDialog } from "@/components/app-dialog";
import { WorkoutExerciseList } from "@/components/workout-exercise-list";
import { WorkoutCategoryIcon } from "@/components/programs/workout-day-chip";
import {
  useCoachCopy,
  useLocale,
  usePlatformCopy,
} from "@/components/locale-provider";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { getWeekdayOptions } from "@/lib/locale-labels";
import { isWeekPlanScheduleActive } from "@/lib/week-plan";
import {
  getWorkoutCategoryStyle,
  inferProgramCategory,
} from "@/lib/workout-visual-categories";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEK_BOARD = [1, 2, 3, 4, 5, 6, 0] as const;

export function WeekPlanPreviewClient({
  plan,
  workouts,
  gender,
}: {
  plan: PersonalWeekPlanListItem;
  workouts: WeekPlanPreviewWorkout[];
  gender?: string | null;
}) {
  const platform = usePlatformCopy();
  const coachCopy = useCoachCopy();
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState<WeekPlanPreviewWorkout | null>(null);
  const isScheduled = isWeekPlanScheduleActive(plan.config);
  const savedWeeks = plan.config.scheduledWeeks ?? 4;
  const [weeks, setWeeks] = useState(savedWeeks);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmAction, dialog: actionDialog } = useSarcasticConfirm();

  const weeksDirty = isScheduled && weeks !== savedWeeks;

  useEffect(() => {
    setWeeks(plan.config.scheduledWeeks ?? 4);
  }, [plan.id, plan.config.scheduledWeeks]);

  const weekdayLabels = useMemo(() => {
    const map = new Map<number, string>();
    for (const opt of getWeekdayOptions(locale)) {
      map.set(opt.value, opt.label);
    }
    return map;
  }, [locale]);

  const byWeekday = useMemo(() => {
    const map = new Map(workouts.map((w) => [w.weekday, w] as const));
    return map;
  }, [workouts]);

  const weekRows = useMemo(
    () =>
      WEEK_BOARD.map((weekday) => ({
        weekday,
        workout: byWeekday.get(weekday) ?? null,
      })),
    [byWeekday]
  );

  const nudgeWeeks = (delta: number) => {
    setWeeks((current) => Math.min(52, Math.max(1, current + delta)));
  };

  const runSchedule = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await schedulePersonalWeekPlan({
        weekPlanId: plan.id,
        weeks,
        startDate: isScheduled
          ? plan.config.scheduledStartDate ?? undefined
          : undefined,
      });
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (result && "success" in result && result.success) {
        setSuccess(
          platform.workout.weekPlanScheduled(
            result.count ?? 0,
            result.weeks ?? weeks
          )
        );
        router.refresh();
      }
    });
  };

  const handleSchedule = () => {
    const copy = weeksDirty
      ? coachCopy.updateWeekPlanSchedule(plan.title, weeks)
      : coachCopy.scheduleWeekPlan(plan.title, weeks);
    confirmAction({
      title: copy.title,
      message: copy.message,
      confirmLabel: copy.confirm,
      cancelLabel: copy.cancel,
      onConfirm: runSchedule,
    });
  };

  const handleDelete = () => {
    const copy = coachCopy.deleteWorkoutPlan(plan.title);
    confirmAction({
      title: copy.title,
      message: copy.message,
      confirmLabel: copy.confirm,
      cancelLabel: copy.cancel,
      onConfirm: () => {
        startTransition(async () => {
          await deletePersonalWorkoutPlan(plan.id);
          router.push("/dashboard/workout/plans");
          router.refresh();
        });
      },
    });
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-xl font-black tracking-tight">
            {plan.title}
          </h1>
          <div className="flex shrink-0 items-center gap-0.5">
            <Link href={`/dashboard/workout/plans/${plan.id}/edit`}>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 px-2.5 text-xs"
                disabled={isPending}
              >
                <Pencil className="h-3.5 w-3.5" />
                {platform.common.edit}
              </Button>
            </Link>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-400"
              disabled={isPending}
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {platform.workout.weekPlanDelete}
            </Button>
          </div>
        </div>

        <ul className="space-y-2">
          {weekRows.map(({ weekday, workout }) => {
            const dayLabel = weekdayLabels.get(weekday) ?? "?";
            if (!workout) {
              return (
                <li key={weekday}>
                  <div className="flex w-full items-center gap-3 rounded-2xl border border-border/40 bg-muted/80 px-3 py-3">
                    <span className="flex h-10 w-11 shrink-0 items-center justify-center rounded-xl border border-border/40 text-[11px] font-black uppercase text-muted-foreground/50">
                      {dayLabel}
                    </span>
                    <p className="text-sm font-medium text-muted-foreground/50">
                      {platform.workout.rest}
                    </p>
                  </div>
                </li>
              );
            }

            const category = inferProgramCategory(
              workout.planTitle,
              [{ title: workout.focus, exercises: workout.exercises }],
              workout.planKind
            );
            const style = getWorkoutCategoryStyle(category);
            return (
              <li key={`${weekday}-${workout.planId}-${workout.dayId}`}>
                <button
                  type="button"
                  onClick={() => setSelected(workout)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                    style.cardBorder,
                    style.cardBg,
                    "hover:brightness-110"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-11 shrink-0 items-center justify-center rounded-xl border text-[11px] font-black uppercase",
                      style.chip,
                      style.chipText
                    )}
                  >
                    {dayLabel}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <WorkoutCategoryIcon category={category} size="sm" />
                      <p className="truncate text-sm font-bold leading-tight">
                        {workout.focus}
                      </p>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {workout.planTitle}
                      {workout.exercises.length > 0
                        ? ` · ${platform.common.exercises(workout.exercises.length)}`
                        : ""}
                    </p>
                  </div>
                  <ChevronRight
                    className={cn("h-4 w-4 shrink-0", style.chipText)}
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
          <span className="col-start-1 row-start-1 justify-self-center text-[10px] font-medium leading-none text-muted-foreground">
            {platform.workout.weekPlanWeeksLabel}:
          </span>
          <div
            className="col-start-1 row-start-2 flex h-8 items-center overflow-hidden rounded-lg border border-border/70 bg-background/50"
            role="group"
            aria-label={platform.workout.weekPlanScheduleWeeks}
          >
            <button
              type="button"
              onClick={() => nudgeWeeks(-1)}
              disabled={isPending || weeks <= 1}
              className="flex h-full w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              aria-label="Decrease weeks"
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <span className="flex h-full min-w-[2.25rem] items-center justify-center border-x border-border/70 px-1.5 text-sm font-semibold tabular-nums">
              {weeks}
            </span>
            <button
              type="button"
              onClick={() => nudgeWeeks(1)}
              disabled={isPending || weeks >= 52}
              className="flex h-full w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              aria-label="Increase weeks"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>

          <Button
            type="button"
            size="sm"
            variant={isScheduled && !weeksDirty ? "secondary" : "default"}
            className={cn(
              "col-start-2 row-start-2 h-8 min-w-0 w-full",
              isScheduled && !weeksDirty && "pointer-events-none opacity-50"
            )}
            disabled={isPending || (isScheduled && !weeksDirty)}
            onClick={handleSchedule}
          >
            {isPending
              ? weeksDirty
                ? platform.workout.weekPlanSavingSchedule
                : platform.workout.weekPlanScheduling
              : weeksDirty
                ? platform.workout.weekPlanSaveSchedule
                : isScheduled
                  ? platform.workout.weekPlanScheduledButton
                  : platform.workout.weekPlanSchedule}
          </Button>
        </div>

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="text-xs text-emerald-400" role="status">
            {success}
          </p>
        ) : null}
      </div>

      <AppDialog
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected?.focus ?? plan.title}
        description={
          selected
            ? [
                weekdayLabels.get(selected.weekday),
                selected.planTitle,
                selected.exercises.length > 0
                  ? platform.common.exercises(selected.exercises.length)
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        maxWidth="max-w-lg"
        className="max-h-[min(92%,40rem)]"
      >
        {selected ? (
          selected.exercises.length > 0 ? (
            <div className="px-5 pb-5">
              <WorkoutExerciseList
                exercises={selected.exercises}
                gender={gender}
              />
            </div>
          ) : (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              {platform.workout.weekPlanPreviewNoExercises}
            </p>
          )
        ) : null}
      </AppDialog>
      {actionDialog}
    </>
  );
}
