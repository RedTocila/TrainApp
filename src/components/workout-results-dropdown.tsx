"use client";

import { useState } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import type { CompletedWorkoutResults } from "@/lib/actions/workout-sessions";
import {
  formatLoggedSetLine,
  formatSessionDuration,
} from "@/lib/workout-results-format";
import { getWorkoutSetStats } from "@/lib/workout-duration";
import { cn } from "@/lib/utils";

export function WorkoutResultsDropdown({
  results,
}: {
  results: CompletedWorkoutResults;
}) {
  const platform = usePlatformCopy();
  const [open, setOpen] = useState(false);
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
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{platform.workout.exercisesTile}</dt>
              <dd className="font-medium">
                {platform.common.exercises(stats.exerciseCount)}
              </dd>
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
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {platform.workout.noteOptional}
              </p>
              <p className="mt-1 text-sm text-foreground">{results.notes}</p>
            </div>
          ) : null}

          {hasLoggedSets ? (
            <ul className="space-y-2">
              {results.exercises.map((exercise) => {
                const lines = exercise.sets
                  .map((set) =>
                    formatLoggedSetLine({
                      reps: set.reps,
                      weight_kg: set.weightKg,
                    })
                  )
                  .filter((line): line is string => !!line);

                return (
                  <li
                    key={exercise.id}
                    className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5"
                  >
                    <p className="text-sm font-semibold">{exercise.name}</p>
                    {lines.length > 0 ? (
                      <ul className="mt-2 space-y-1">
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
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {platform.workout.repsTarget(exercise.targetReps)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {platform.workout.noResultsLogged}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
