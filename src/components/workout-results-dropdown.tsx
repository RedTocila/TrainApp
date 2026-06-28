"use client";

import { useState } from "react";
import { Check, ChevronDown, ClipboardList, Clock, Dumbbell } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { dashboard, DashboardSectionHeading } from "@/components/dashboard-ui";
import type { CompletedWorkoutResults } from "@/lib/actions/workout-sessions";
import {
  formatLoggedSetLine,
  formatSessionDuration,
} from "@/lib/workout-results-format";
import { getWorkoutSetStats } from "@/lib/workout-duration";
import { cn } from "@/lib/utils";

function WorkoutStatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Clock;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/80 px-2 py-3 text-center">
      <Icon className="mb-1.5 h-4 w-4 text-primary" />
      <p className="text-lg font-black tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export function WorkoutResultsContent({
  results,
  variant,
}: {
  results: CompletedWorkoutResults;
  variant: "dropdown" | "open";
}) {
  const platform = usePlatformCopy();
  const duration = formatSessionDuration(results.startedAt, results.completedAt);
  const stats = getWorkoutSetStats(
    results.exercises.map((exercise) => ({
      target_sets: exercise.sets.length,
      sets: exercise.sets.map((set) => ({
        reps: set.reps,
        weight_kg: set.weightKg,
        completed: set.reps != null || set.weightKg != null,
      })),
    }))
  );
  const hasLoggedSets = stats.loggedSets > 0;

  if (variant === "open") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <WorkoutStatCard
            icon={Clock}
            label={platform.workout.elapsed}
            value={duration || "—"}
          />
          <WorkoutStatCard
            icon={Dumbbell}
            label={platform.workout.exercisesTile}
            value={String(stats.exerciseCount)}
          />
          <WorkoutStatCard
            icon={ClipboardList}
            label={platform.workout.set}
            value={`${stats.loggedSets}/${stats.totalSets}`}
          />
        </div>

        {results.notes ? (
          <div className={cn(dashboard.listRow, "flex-col items-start gap-1.5 py-3")}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {platform.workout.noteOptional}
            </p>
            <p className="text-sm leading-relaxed text-foreground">{results.notes}</p>
          </div>
        ) : null}

        {hasLoggedSets ? (
          <ul className="space-y-2">
            {results.exercises.map((exercise) => {
              const loggedSets = exercise.sets.filter(
                (set) =>
                  formatLoggedSetLine({ reps: set.reps, weight_kg: set.weightKg }) != null
              );
              if (loggedSets.length === 0) return null;

              return (
                <li key={exercise.id} className={cn(dashboard.tile, "overflow-hidden")}>
                  <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Dumbbell className="h-4 w-4 text-primary" />
                    </div>
                    <p className="min-w-0 flex-1 text-sm font-semibold">{exercise.name}</p>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                      {loggedSets.length}/{exercise.sets.length}
                    </span>
                  </div>
                  <ul className="divide-y divide-border/40">
                    {exercise.sets.map((set) => {
                      const line = formatLoggedSetLine({
                        reps: set.reps,
                        weight_kg: set.weightKg,
                      });
                      if (!line) return null;
                      return (
                        <li
                          key={set.setNumber}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/15">
                              <Check className="h-3 w-3 text-green-400" />
                            </span>
                            <span className="text-muted-foreground">
                              {platform.workout.set} {set.setNumber}
                            </span>
                          </div>
                          <span className="font-semibold tabular-nums">{line}</span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={cn(dashboard.empty, "py-5 text-sm")}>
            {platform.workout.noResultsLogged}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{platform.workout.exercisesTile}</dt>
          <dd className="font-medium">{platform.common.exercises(stats.exerciseCount)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{platform.workout.set}</dt>
          <dd className="font-medium">
            {platform.workout.setsLogged(stats.loggedSets, stats.totalSets)}
          </dd>
        </div>
        {duration ? (
          <div>
            <dt className="text-muted-foreground">{platform.workout.elapsed}</dt>
            <dd className="font-medium tabular-nums">{duration}</dd>
          </div>
        ) : null}
      </dl>

      {results.notes ? (
        <div className={cn(dashboard.listRow, "flex-col items-start gap-1 py-3")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {platform.workout.noteOptional}
          </p>
          <p className="text-sm text-foreground">{results.notes}</p>
        </div>
      ) : null}

      {hasLoggedSets ? (
        <ul className="space-y-2">
          {results.exercises.map((exercise) => (
            <li key={exercise.id} className={cn(dashboard.listRow, "flex-col items-start gap-2 py-3")}>
              <p className="text-sm font-semibold">{exercise.name}</p>
              <ul className="w-full space-y-1">
                {exercise.sets.map((set) => {
                  const line = formatLoggedSetLine({
                    reps: set.reps,
                    weight_kg: set.weightKg,
                  });
                  if (!line) return null;
                  return (
                    <li
                      key={set.setNumber}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {platform.workout.set} {set.setNumber}
                      </span>
                      <span className="font-medium tabular-nums">{line}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{platform.workout.noResultsLogged}</p>
      )}
    </>
  );
}

export function WorkoutResultsDropdown({
  results,
  variant = "dropdown",
}: {
  results: CompletedWorkoutResults;
  variant?: "dropdown" | "open";
}) {
  const platform = usePlatformCopy();
  const [open, setOpen] = useState(variant === "open");
  const duration = formatSessionDuration(results.startedAt, results.completedAt);

  if (variant === "open") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
          <DashboardSectionHeading className="mb-0">
            {platform.workout.workoutResults}
          </DashboardSectionHeading>
          {duration ? (
            <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
              {duration}
            </span>
          ) : null}
        </div>
        <WorkoutResultsContent results={results} variant="open" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-green-500/20 bg-green-500/5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-3 text-left sm:px-4"
        aria-expanded={open}
        aria-label={
          open ? platform.aria.collapseWorkoutResults : platform.aria.expandWorkoutResults
        }
      >
        <ClipboardList className="h-4 w-4 shrink-0 text-green-400" />
        <span className="min-w-0 flex-1 text-sm font-semibold text-green-400">
          {platform.workout.workoutResults}
        </span>
        {duration ? (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {duration}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-green-500/15 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          <WorkoutResultsContent results={results} variant="dropdown" />
        </div>
      ) : null}
    </div>
  );
}
