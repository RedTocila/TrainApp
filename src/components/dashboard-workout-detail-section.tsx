"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Flame, PersonStanding } from "lucide-react";
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
import {
  estimateWorkoutDurationSeconds,
  formatWorkoutDurationShort,
} from "@/lib/workout-duration";
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

function ExtraSessionIcon({
  planKind,
  className,
}: {
  planKind: TodaysWorkoutInfo["planKind"];
  className?: string;
}) {
  if (planKind === "stretch") {
    return (
      <PersonStanding className={cn("text-teal-400", className)} aria-hidden />
    );
  }
  return <Flame className={cn("text-orange-400", className)} aria-hidden />;
}

function extraMetaLine(
  workout: TodaysWorkoutInfo,
  exerciseCount: number,
  platform: ReturnType<typeof usePlatformCopy>
) {
  const parts: string[] = [];
  if (exerciseCount > 0) {
    parts.push(platform.common.exercises(exerciseCount));
  }

  const intervalWork = workout.exercises.reduce((sum, ex) => {
    const match = /^(\d+)\s*s$/i.exec(ex.reps.trim());
    return sum + (match ? Number(match[1]) * Math.max(1, ex.sets) : 0);
  }, 0);

  if (intervalWork > 0) {
    parts.push(formatWorkoutDurationShort(intervalWork));
  } else if (exerciseCount > 0) {
    parts.push(
      formatWorkoutDurationShort(
        estimateWorkoutDurationSeconds(
          workout.exercises.map((ex) => ({ target_sets: ex.sets }))
        )
      )
    );
  }

  return parts.join(" · ");
}

export function DashboardWorkoutDetailSection({
  workout,
  workoutKey,
  done,
  skipped = false,
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
  skipped?: boolean;
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
  const [open, setOpen] = useState(() => !isExtra || highlighted);
  const isHistory = !!workout.historySessionId;
  const handled = done || skipped;
  const canStart = !handled && !readOnly && !isHistory;
  const resultsSessionId = done
    ? sessionId ?? workout.historySessionId ?? null
    : null;
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
    if (isExtra) setOpen(true);
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
  }, [highlighted, isExtra]);

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

  const containerTone = skipped
    ? "border-border/70 bg-secondary/30 opacity-90"
    : workout.planKind === "warmup"
      ? "border-orange-500/35 bg-orange-500/[0.08]"
      : workout.planKind === "stretch"
        ? "border-teal-500/35 bg-teal-500/[0.08]"
        : workout.planKind === "hiit"
          ? "border-fuchsia-500/35 bg-fuchsia-500/[0.08]"
          : "border-primary/25 bg-primary/[0.06]";

  if (isExtra) {
    const kindLabel =
      workout.planKind === "stretch"
        ? platform.workout.sessionTypeStretch
        : platform.workout.sessionTypeWarmup;
    const meta = extraMetaLine(workout, mapExercises.length, platform);

    return (
      <section
        ref={sectionRef}
        id={`workout-${workoutKey}`}
        className={cn(
          "relative scroll-mt-24 overflow-hidden rounded-xl border",
          containerTone,
          highlighted && "ring-1 ring-primary/30"
        )}
      >
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/60">
            <ExtraSessionIcon
              planKind={workout.planKind}
              className="h-4 w-4"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p
                className={cn(
                  "truncate text-sm font-semibold leading-tight",
                  handled && "text-muted-foreground"
                )}
              >
                {workout.dayTitle}
              </p>
              <Badge
                className={cn(
                  "h-5 px-1.5 text-[10px]",
                  workout.planKind === "stretch"
                    ? "bg-teal-500/15 text-teal-400"
                    : "bg-orange-500/15 text-orange-400"
                )}
              >
                {kindLabel}
              </Badge>
              {done ? (
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {platform.common.completed}
                </span>
              ) : null}
              {skipped ? (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                  {platform.workout.sessionSkipped}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {[results?.planTitle ?? workout.planTitle, meta]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          {canStart ? (
            <div className="shrink-0">
              <StartTodaysWorkoutButton
                date={selectedDate}
                workout={workout}
                disabled={!isDayLoaded}
                display="text"
              />
            </div>
          ) : null}
        </div>

        {open ? (
          <div
            className={cn(
              "space-y-3 border-t border-border/40 px-3 pt-3",
              skipped && "opacity-70"
            )}
          >
            {mapExercises.length > 0 ? (
              <WorkoutExerciseList exercises={mapExercises} gender={gender} />
            ) : null}

            {done ? (
              loadingResults ? (
                <WorkoutResultsSkeleton />
              ) : results ? (
                <WorkoutResultsDropdown
                  results={results}
                  variant="open"
                  gender={gender}
                />
              ) : null
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-end px-3 pb-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground",
              workout.planKind === "warmup" && "hover:text-orange-300",
              workout.planKind === "stretch" && "hover:text-teal-300"
            )}
            aria-expanded={open}
          >
            {open
              ? platform.pricing.hideDetails
              : platform.dashboard.moreDetails}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                open && "rotate-180"
              )}
            />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      id={`workout-${workoutKey}`}
      className={cn(
        "relative scroll-mt-24 space-y-4 rounded-2xl border p-4 sm:p-5",
        containerTone,
        highlighted && "ring-1 ring-primary/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={cn(
                "text-lg font-black tracking-tight sm:text-xl",
                handled && "text-muted-foreground"
              )}
            >
              {workout.dayTitle}
            </h2>
            <Badge className="bg-primary/15 text-[10px] text-primary">
              {platform.workout.sessionTypeMain}
            </Badge>
            {mapExercises.length > 0 && !handled ? (
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
            {skipped ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                {platform.workout.sessionSkipped}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {results?.planTitle ?? workout.planTitle}
            {mapExercises.length > 0
              ? ` · ${platform.common.exercises(mapExercises.length)}`
              : null}
          </p>
          {mapExercises.length > 0 ? (
            <DashboardWorkoutCompactStats
              exercises={mapExercises}
              className="mt-2"
            />
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canStart ? (
            <StartTodaysWorkoutButton
              date={selectedDate}
              workout={undefined}
              dayFlow
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

          {mapExercises.length > 0 ? (
            <div className={cn(skipped && "opacity-70")}>
              <WorkoutExerciseList exercises={mapExercises} gender={gender} />
            </div>
          ) : null}

          {done ? (
            loadingResults ? (
              <WorkoutResultsSkeleton />
            ) : results ? (
              <WorkoutResultsDropdown
                results={results}
                variant="open"
                gender={gender}
              />
            ) : null
          ) : null}
        </>
      ) : null}
    </section>
  );
}
