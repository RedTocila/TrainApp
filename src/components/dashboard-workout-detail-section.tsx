"use client";

import { useEffect, useRef, useState } from "react";
import { usePlatformCopy } from "@/components/locale-provider";
import { DashboardWorkoutCompactStats } from "@/components/dashboard-workout-compact-meta";
import { DashboardStatusCheck } from "@/components/section-completed-badge";
import { StartTodaysWorkoutButton } from "@/components/start-todays-workout-button";
import { WorkoutDifficultyInsightButton } from "@/components/workout-difficulty-insight-button";
import { WorkoutExerciseList } from "@/components/workout-exercise-list";
import { WorkoutMuscleMap } from "@/components/workout-muscle-map";
import { WorkoutResultsDropdown } from "@/components/workout-results-dropdown";
import { dashboard } from "@/components/dashboard-ui";
import type { Profile } from "@/lib/types";
import {
  getCompletedWorkoutResultsForSession,
  type CompletedWorkoutResults,
  type TodaysWorkoutInfo,
} from "@/lib/actions/workout-sessions";
import { cn } from "@/lib/utils";

function WorkoutResultsLoading() {
  return (
    <div
      className={cn(dashboard.listRow, "justify-center py-6")}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="coach-alex-nav-loading__pulse-dot" />
      <span className="coach-alex-nav-loading__pulse-dot" />
      <span className="coach-alex-nav-loading__pulse-dot" />
    </div>
  );
}

export function DashboardWorkoutDetailSection({
  workout,
  workoutKey,
  done,
  highlighted = false,
  isDayLoaded,
  selectedDate,
  sessionId,
  gender,
  intakeProfile,
}: {
  workout: TodaysWorkoutInfo;
  workoutKey: string;
  done: boolean;
  highlighted?: boolean;
  isDayLoaded: boolean;
  selectedDate: Date;
  sessionId: string | null;
  gender?: string | null;
  intakeProfile?: Pick<Profile, "age" | "intake_responses"> | null;
}) {
  const platform = usePlatformCopy();
  const sectionRef = useRef<HTMLElement>(null);
  const [results, setResults] = useState<CompletedWorkoutResults | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    if (!highlighted) return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlighted]);

  useEffect(() => {
    setResults(null);
    setLoadingResults(false);
  }, [workout.taskId]);

  useEffect(() => {
    if (!done || !sessionId) return;

    let cancelled = false;
    setLoadingResults(true);
    void getCompletedWorkoutResultsForSession(sessionId).then((data) => {
      if (cancelled) return;
      setResults(data);
      setLoadingResults(false);
    });

    return () => {
      cancelled = true;
    };
  }, [done, sessionId]);

  return (
    <section
      ref={sectionRef}
      id={`workout-${workoutKey}`}
      className={cn(
        "scroll-mt-24 space-y-4 rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5",
        highlighted && "border-primary/40 ring-1 ring-primary/25"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={cn(
                "text-lg font-black tracking-tight sm:text-xl",
                done && "text-muted-foreground line-through"
              )}
            >
              {workout.dayTitle}
            </h2>
            {workout.exercises.length > 0 ? (
              <WorkoutDifficultyInsightButton
                exercises={workout.exercises}
                intakeProfile={intakeProfile}
                size="compact"
              />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {workout.planTitle}
            {workout.exercises.length > 0
              ? ` · ${platform.common.exercises(workout.exercises.length)}`
              : null}
          </p>
          {workout.exercises.length > 0 ? (
            <DashboardWorkoutCompactStats
              exercises={workout.exercises}
              className="mt-2"
            />
          ) : null}
        </div>
        <div className="shrink-0">
          {done ? (
            <DashboardStatusCheck aria-label={platform.aria.completed} />
          ) : (
            <StartTodaysWorkoutButton
              date={selectedDate}
              workout={workout}
              disabled={!isDayLoaded}
              display="text"
            />
          )}
        </div>
      </div>

      {workout.exercises.length > 0 ? (
        <div className={cn(dashboard.tile, "p-4 sm:p-5")}>
          <WorkoutMuscleMap
            exercises={workout.exercises}
            dayTitle={workout.dayTitle}
            gender={gender}
          />
        </div>
      ) : null}

      {done ? (
        loadingResults ? (
          <WorkoutResultsLoading />
        ) : results ? (
          <WorkoutResultsDropdown results={results} variant="open" />
        ) : (
          <p className={cn(dashboard.empty, "py-5 text-sm")}>
            {platform.workout.noResultsLogged}
          </p>
        )
      ) : workout.exercises.length > 0 ? (
        <WorkoutExerciseList exercises={workout.exercises} />
      ) : null}
    </section>
  );
}
