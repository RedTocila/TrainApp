"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { DashboardWorkoutCompactStats } from "@/components/dashboard-workout-compact-meta";
import { StartTodaysWorkoutButton } from "@/components/start-todays-workout-button";
import { WorkoutDifficultyInsightButton } from "@/components/workout-difficulty-insight-button";
import { WorkoutExerciseList } from "@/components/workout-exercise-list";
import { WorkoutMuscleMap } from "@/components/workout-muscle-map";
import { WorkoutResultsDropdown } from "@/components/workout-results-dropdown";
import { dashboard } from "@/components/dashboard-ui";
import { Badge } from "@/components/ui/badge";
import { isExtraWorkoutKind, isMainWorkoutKind } from "@/lib/hiit";
import type { Profile } from "@/lib/types";
import {
  getCompletedWorkoutResultsForSession,
  type CompletedWorkoutResults,
  type TodaysWorkoutInfo,
} from "@/lib/actions/workout-sessions";
import { cn } from "@/lib/utils";

function Pulse({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-secondary/80", className)} />
  );
}

function WorkoutResultsSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-busy="true" aria-live="polite">
      <Pulse className="h-12 w-full rounded-xl" />
      <Pulse className="h-12 w-full rounded-xl" />
      <Pulse className="h-12 w-full rounded-xl" />
    </div>
  );
}

export function DashboardWorkoutDetailSkeleton() {
  return (
    <div
      className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="space-y-2">
        <Pulse className="h-7 w-48 rounded-md" />
        <Pulse className="h-4 w-36 rounded-md" />
      </div>
      <Pulse className="h-40 w-full rounded-2xl" />
      <div className="space-y-2">
        <Pulse className="h-14 w-full rounded-xl" />
        <Pulse className="h-14 w-full rounded-xl" />
        <Pulse className="h-14 w-full rounded-xl" />
      </div>
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
  readOnly = false,
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
  readOnly?: boolean;
}) {
  const platform = usePlatformCopy();
  const sectionRef = useRef<HTMLElement>(null);
  const [results, setResults] = useState<CompletedWorkoutResults | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const isExtra = isExtraWorkoutKind(workout.planKind);
  const [open, setOpen] = useState(!isExtra);
  const isHistory = !!workout.historySessionId;
  const canStart = !done && !readOnly && !isHistory;
  const resultsSessionId = sessionId ?? workout.historySessionId ?? null;
  const showMuscleMap = isMainWorkoutKind(workout.planKind);
  const showBody = !isExtra || open;

  const mapExercises = useMemo(() => {
    if (workout.exercises.length > 0) return workout.exercises;
    if (!results?.exercises.length) return [];
    return results.exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      sets: Math.max(1, ex.sets.length),
      reps: ex.targetReps || String(ex.sets[0]?.reps ?? ""),
      notes: null as string | null,
    }));
  }, [workout.exercises, results]);

  useEffect(() => {
    if (!highlighted) return;
    const main = document.querySelector<HTMLElement>(".dashboard-main");
    const el = sectionRef.current;
    if (!el || !main) {
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const header = main.querySelector<HTMLElement>("header");
    const headerHeight = header?.offsetHeight ?? 0;
    const mainRect = main.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetTop =
      main.scrollTop + (elRect.top - mainRect.top) - headerHeight - 8;
    main.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, [highlighted]);

  useEffect(() => {
    setResults(null);
    setLoadingResults(false);
  }, [workout.taskId]);

  useEffect(() => {
    if (!done || !resultsSessionId) return;

    let cancelled = false;
    setLoadingResults(true);
    void getCompletedWorkoutResultsForSession(resultsSessionId)
      .then((data) => {
        if (cancelled) return;
        setResults(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingResults(false);
      });

    return () => {
      cancelled = true;
    };
  }, [done, resultsSessionId]);

  const headerMeta = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h2
          className={cn(
            "text-lg font-black tracking-tight sm:text-xl",
            done && "text-muted-foreground"
          )}
        >
          {workout.dayTitle}
        </h2>
        {workout.planKind === "warmup" ? (
          <Badge className="bg-orange-500/15 text-[10px] text-orange-400">
            {platform.workout.sessionTypeWarmup}
          </Badge>
        ) : null}
        {workout.planKind === "stretch" ? (
          <Badge className="bg-teal-500/15 text-[10px] text-teal-400">
            {platform.workout.sessionTypeStretch}
          </Badge>
        ) : null}
        {showBody && mapExercises.length > 0 && !done ? (
          <WorkoutDifficultyInsightButton
            exercises={mapExercises}
            intakeProfile={intakeProfile}
            size="compact"
          />
        ) : null}
        {done ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {platform.common.completed}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {results?.planTitle ?? workout.planTitle}
        {mapExercises.length > 0
          ? ` · ${platform.common.exercises(mapExercises.length)}`
          : null}
      </p>
    </>
  );

  const containerTone =
    workout.planKind === "warmup"
      ? "border-orange-500/35 bg-orange-500/[0.08]"
      : workout.planKind === "stretch"
        ? "border-teal-500/35 bg-teal-500/[0.08]"
        : workout.planKind === "hiit"
          ? "border-fuchsia-500/35 bg-fuchsia-500/[0.08]"
          : "border-primary/25 bg-primary/[0.06]";

  return (
    <section
      ref={sectionRef}
      id={`workout-${workoutKey}`}
      className={cn(
        "relative scroll-mt-24 space-y-4 rounded-2xl border p-4 sm:p-5",
        containerTone,
        highlighted && "ring-1 ring-primary/30",
        isExtra && "pb-11 sm:pb-12"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isExtra ? (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="w-full text-left"
              aria-expanded={open}
            >
              {headerMeta}
            </button>
          ) : (
            headerMeta
          )}
          {showBody && mapExercises.length > 0 ? (
            <DashboardWorkoutCompactStats
              exercises={mapExercises}
              className="mt-2"
            />
          ) : null}
        </div>
        <div className="shrink-0">
          {canStart ? (
            <StartTodaysWorkoutButton
              date={selectedDate}
              workout={workout}
              disabled={!isDayLoaded}
              display="text"
            />
          ) : null}
        </div>
      </div>

      {showBody ? (
        <>
          {showMuscleMap && mapExercises.length > 0 ? (
            <div className={cn(dashboard.tile, "p-4 sm:p-5")}>
              <WorkoutMuscleMap
                exercises={mapExercises}
                dayTitle={results?.dayTitle ?? workout.dayTitle}
                gender={gender}
              />
            </div>
          ) : null}

          {done ? (
            loadingResults ? (
              <WorkoutResultsSkeleton />
            ) : results ? (
              <WorkoutResultsDropdown results={results} variant="open" gender={gender} />
            ) : (
              <p className={cn(dashboard.empty, "py-5 text-sm")}>
                {platform.workout.noResultsLogged}
              </p>
            )
          ) : mapExercises.length > 0 ? (
            <WorkoutExerciseList exercises={mapExercises} gender={gender} />
          ) : null}
        </>
      ) : null}

      {isExtra ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "absolute bottom-2.5 right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground",
            workout.planKind === "warmup" && "border-orange-500/30 text-orange-300",
            workout.planKind === "stretch" && "border-teal-500/30 text-teal-300"
          )}
          aria-expanded={open}
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
      ) : null}
    </section>
  );
}
