"use client";

import { useMemo, useState } from "react";
import type { PersonalWorkoutListItem } from "@/lib/actions/user-workouts";
import { collectPlanExercises } from "@/components/programs/personal-workout-list-card";
import { WorkoutCategoryIcon } from "@/components/programs/workout-day-chip";
import { WorkoutCategoryFilter as WorkoutCategoryFilterBar } from "@/components/programs/workout-color-legend";
import { WorkoutMuscleMap } from "@/components/workout-muscle-map";
import { AppDialog } from "@/components/app-dialog";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  getWorkoutCategoryStyle,
  inferProgramCategory,
  workoutMatchesCategory,
  type WorkoutCategoryFilter as WorkoutCategoryFilterId,
} from "@/lib/workout-visual-categories";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type WeekPlanWorkoutPick = {
  planId: string;
  dayId: string;
  focus: string;
  planTitle: string;
};

export function SelectableWorkoutCard({
  item,
  gender,
  selected,
  onSelect,
  dayLabel,
}: {
  item: PersonalWorkoutListItem;
  gender?: string | null;
  selected?: boolean;
  onSelect: () => void;
  /** When a specific day of a multi-day plan is chosen. */
  dayLabel?: string | null;
}) {
  const platform = usePlatformCopy();
  const { plan, days, scheduleSummary } = item;
  const exercises = collectPlanExercises(item);
  const exerciseCount = exercises.length;
  const programCategory = inferProgramCategory(plan.title, days, plan.kind);
  const programStyle = getWorkoutCategoryStyle(programCategory);
  const dayTitle =
    days.length === 1
      ? [plan.title, days[0]?.title].filter(Boolean).join(" ")
      : plan.title;
  const meta = [
    programStyle.shortLabel,
    dayLabel
      ? dayLabel
      : days.length > 1
        ? platform.workout.daysBadge(days.length)
        : null,
    exerciseCount > 0 ? platform.common.exercises(exerciseCount) : null,
    scheduleSummary,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button type="button" onClick={onSelect} className="w-full text-left">
      <Card
        className={cn(
          "relative overflow-hidden border transition-colors",
          programStyle.cardBorder,
          programStyle.cardBg,
          selected && "ring-2 ring-primary"
        )}
      >
        <div className="flex">
          <div className={cn("w-1 shrink-0", programStyle.stripe)} aria-hidden />
          <div className="flex min-w-0 flex-1 items-stretch gap-2 p-2.5">
            {exerciseCount > 0 ? (
              <WorkoutMuscleMap
                variant="hero"
                exercises={exercises}
                dayTitle={dayTitle}
                gender={gender}
                showLegend={false}
                bodyMinHeightClass="h-[4.75rem] min-h-0 max-h-[4.75rem]"
                className="pointer-events-none w-[5.5rem] shrink-0 self-center sm:w-[6.25rem]"
              />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <div className="flex min-w-0 items-center gap-2">
                <WorkoutCategoryIcon category={programCategory} size="sm" />
                <p className="min-w-0 truncate text-sm font-bold leading-tight">
                  {plan.title}
                </p>
              </div>
              <p className="truncate text-[11px] leading-snug text-muted-foreground">
                {meta}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </button>
  );
}

export function WeekPlanWorkoutPicker({
  open,
  onClose,
  workouts,
  gender,
  selectedPlanId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  workouts: PersonalWorkoutListItem[];
  gender?: string | null;
  selectedPlanId?: string;
  onPick: (pick: WeekPlanWorkoutPick) => void;
}) {
  const platform = usePlatformCopy();
  const [categoryFilter, setCategoryFilter] =
    useState<WorkoutCategoryFilterId>("all");
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  const usable = useMemo(
    () => workouts.filter((item) => collectPlanExercises(item).length > 0),
    [workouts]
  );

  const filtered = useMemo(
    () =>
      usable.filter(({ plan, days }) =>
        workoutMatchesCategory(plan.title, days, categoryFilter, plan.kind)
      ),
    [usable, categoryFilter]
  );

  const pendingItem = pendingPlanId
    ? usable.find((w) => w.plan.id === pendingPlanId) ?? null
    : null;

  const handleClose = () => {
    setPendingPlanId(null);
    onClose();
  };

  const commitPick = (item: PersonalWorkoutListItem, dayId: string) => {
    const day = item.days.find((d) => d.id === dayId) ?? item.days[0];
    onPick({
      planId: item.plan.id,
      dayId: day?.id ?? "",
      focus: day?.title || item.plan.title,
      planTitle: item.plan.title,
    });
    setPendingPlanId(null);
    onClose();
  };

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title={
        pendingItem
          ? platform.workout.weekPlanBuilderPickDay
          : platform.workout.weekPlanBuilderPickWorkout
      }
      maxWidth="max-w-lg"
      className="max-h-[min(94dvh,40rem)]"
      ariaLabel={platform.workout.weekPlanBuilderPickWorkout}
    >
      <div className="space-y-3 px-5 pb-5">
        {pendingItem ? (
          <>
            <p className="text-sm text-muted-foreground">{pendingItem.plan.title}</p>
            <ul className="space-y-2">
              {pendingItem.days.map((day) => (
                <li key={day.id}>
                  <button
                    type="button"
                    onClick={() => commitPick(pendingItem, day.id)}
                    className="w-full rounded-xl border border-border/70 bg-secondary/30 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <p className="text-sm font-bold">{day.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {platform.common.exercises(day.exercises?.length ?? 0)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setPendingPlanId(null)}
            >
              {platform.common.back}
            </Button>
          </>
        ) : (
          <>
            <WorkoutCategoryFilterBar
              workouts={usable}
              selected={categoryFilter}
              onSelectedChange={setCategoryFilter}
              edgeFade={false}
            />
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {platform.workout.weekPlanBuilderNoWorkouts}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {filtered.map((item) => (
                  <li key={item.plan.id}>
                    <SelectableWorkoutCard
                      item={item}
                      gender={gender}
                      selected={selectedPlanId === item.plan.id}
                      onSelect={() => {
                        if (item.days.length > 1) {
                          setPendingPlanId(item.plan.id);
                          return;
                        }
                        commitPick(item, item.days[0]?.id ?? "");
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </AppDialog>
  );
}
