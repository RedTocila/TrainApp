"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { ChevronRight, Dumbbell, Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardDateFetch } from "@/components/dashboard-date-loading";
import { useDashboardSync } from "@/components/dashboard-sync";
import { isWorkoutCompletedFromPatches } from "@/lib/dashboard-enrichment-utils";
import {
  StartTodaysWorkoutButton,
  useStartTodaysWorkout,
} from "@/components/start-todays-workout-button";
import { WorkoutExerciseList } from "@/components/workout-exercise-list";
import { DashboardWorkoutCompactStats } from "@/components/dashboard-workout-compact-meta";
import { WorkoutDifficultyInsightButton } from "@/components/workout-difficulty-insight-button";
import { useRegisterWorkoutPageChrome } from "@/components/workout-page-chrome-context";
import {
  DashboardStatusCheck,
} from "@/components/section-completed-badge";
import { dashboard, DashboardEmptyState } from "@/components/dashboard-ui";
import {
  resolveWorkoutForDate,
  isWorkoutCompletedOnDate,
  getCompletedWorkoutResultsForDate,
  getCompletedWorkoutResultsForSession,
  type TodaysWorkoutInfo,
  type CompletedWorkoutResults,
} from "@/lib/actions/workout-sessions";
import { WorkoutResultsDropdown } from "@/components/workout-results-dropdown";
import { WorkoutMuscleMap } from "@/components/workout-muscle-map";
import { formatDateKey, cn } from "@/lib/utils";
import {
  estimateWorkoutDurationSeconds,
  formatWorkoutDurationShort,
} from "@/lib/workout-duration";
import { DASHBOARD_DAY_WORKOUT_PATH } from "@/lib/dashboard-day-routes";
import {
  DashboardCardNavBody,
  DashboardCardNavLink,
  dashboardInteractive,
} from "@/components/dashboard-card-nav-link";
import {
  setWorkoutDayCache,
  getWorkoutDayCache,
  workoutDayCacheKey,
} from "@/lib/dashboard-route-cache";
import { isDashboardDayCacheFresh } from "@/lib/dashboard-day-cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChangeWorkoutDialog } from "@/components/change-workout-dialog";
import { MissedButton } from "@/components/missed-items-dialog";
import {
  isDeadlinePassed,
  WORKOUT_DEADLINE,
} from "@/lib/meal-times";
import type { Profile } from "@/lib/types";

const WORKOUT_RESULTS_RETRY_MS = [0, 400, 800, 1500, 2500, 4000, 6000];

type WorkoutDayCache = {
  workout: TodaysWorkoutInfo | null;
  completed: boolean;
  results: CompletedWorkoutResults | null;
};

async function loadWorkoutResults(
  clientId: string,
  dateKey: string,
  sessionId?: string
): Promise<CompletedWorkoutResults | null> {
  if (sessionId) {
    const bySession = await getCompletedWorkoutResultsForSession(sessionId);
    if (bySession) return bySession;
  }
  return getCompletedWorkoutResultsForDate(clientId, dateKey);
}

export function DashboardWorkoutCard({
  clientId,
  gender,
  intakeProfile,
  initialWorkout,
  initialWorkoutCompleted = false,
  initialWorkoutResults = null,
  variant = "full",
}: {
  clientId: string;
  gender?: string | null;
  intakeProfile?: Pick<Profile, "age" | "intake_responses"> | null;
  initialWorkout: TodaysWorkoutInfo | null;
  initialWorkoutCompleted?: boolean;
  initialWorkoutResults?: CompletedWorkoutResults | null;
  variant?: "full" | "compact" | "detail";
}) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const router = useRouter();
  const { selectedDate, todayKey } = useSelectedDate();
  const { version, patches } = useDashboardSync();
  const dateKey = formatDateKey(selectedDate);
  const [workout, setWorkout] = useState(initialWorkout);
  const [workoutCompleted, setWorkoutCompleted] = useState(
    initialWorkoutCompleted
  );
  const [workoutResults, setWorkoutResults] =
    useState<CompletedWorkoutResults | null>(initialWorkoutResults);
  const [loadedDateKey, setLoadedDateKey] = useState(dateKey);
  const [changeWorkoutOpen, setChangeWorkoutOpen] = useState(false);
  const workoutCacheRef = useRef<Map<string, WorkoutDayCache>>(new Map());

  useEffect(() => {
    router.prefetch(DASHBOARD_DAY_WORKOUT_PATH);
  }, [router]);

  useEffect(() => {
    workoutCacheRef.current.set(dateKey, {
      workout: initialWorkout,
      completed: initialWorkoutCompleted,
      results: initialWorkoutResults,
    });
    setWorkoutDayCache(clientId, dateKey, {
      workout: initialWorkout,
      completed: initialWorkoutCompleted,
      results: initialWorkoutResults,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed SSR snapshot once
  }, []);

  // Sync SSR props when the server revalidates for today only.
  useEffect(() => {
    if (dateKey !== todayKey) return;
    const snapshot: WorkoutDayCache = {
      workout: initialWorkout,
      completed: initialWorkoutCompleted,
      results: initialWorkoutResults,
    };
    workoutCacheRef.current.set(dateKey, snapshot);
    setWorkoutDayCache(clientId, dateKey, snapshot);
    setWorkout(snapshot.workout);
    setWorkoutCompleted(snapshot.completed);
    if (initialWorkoutResults) setWorkoutResults(initialWorkoutResults);
    setLoadedDateKey(dateKey);
  }, [initialWorkout, initialWorkoutCompleted, initialWorkoutResults, dateKey, todayKey]);

  const prevDateKeyRef = useRef(dateKey);
  useEffect(() => {
    if (prevDateKeyRef.current === dateKey) return;
    prevDateKeyRef.current = dateKey;

    const cached = workoutCacheRef.current.get(dateKey);
    if (cached) {
      setWorkout(cached.workout);
      setWorkoutCompleted(cached.completed);
      setWorkoutResults(cached.results);
      setLoadedDateKey(dateKey);
      return;
    }

    const shared = getWorkoutDayCache(clientId, dateKey);
    if (shared) {
      workoutCacheRef.current.set(dateKey, shared);
      setWorkout(shared.workout);
      setWorkoutCompleted(shared.completed);
      setWorkoutResults(shared.results);
      setLoadedDateKey(dateKey);
      return;
    }

    setWorkout(null);
    setWorkoutCompleted(false);
    setWorkoutResults(null);
  }, [dateKey]);

  const refreshWorkout = useCallback(async () => {
    const key = formatDateKey(selectedDate);
    const [resolved, completed] = await Promise.all([
      resolveWorkoutForDate(clientId, key),
      isWorkoutCompletedOnDate(clientId, key),
    ]);

    if (formatDateKey(selectedDate) !== key) return;

    const dayComplete =
      completed || isWorkoutCompletedFromPatches(patches, key);
    const previous = workoutCacheRef.current.get(key);

    workoutCacheRef.current.set(key, {
      workout: resolved,
      completed,
      results: dayComplete ? (previous?.results ?? null) : null,
    });
    setWorkoutDayCache(clientId, key, workoutCacheRef.current.get(key)!);

    setWorkout(resolved);
    setWorkoutCompleted(completed);
    setLoadedDateKey(key);

    if (!dayComplete) {
      setWorkoutResults(null);
      return;
    }

    void loadWorkoutResults(
      clientId,
      key,
      patches.workoutSessionIds[key]
    ).then((results) => {
      if (formatDateKey(selectedDate) !== key) return;
      setWorkoutResults(results);
      const cached = workoutCacheRef.current.get(key);
      if (cached) cached.results = results;
    });
  }, [clientId, selectedDate, patches]);

  const skipWorkoutRefresh =
    variant === "detail" &&
    isDashboardDayCacheFresh(workoutDayCacheKey(clientId, dateKey)) &&
    getWorkoutDayCache(clientId, dateKey) !== undefined;

  useDashboardDateFetch(dateKey, refreshWorkout, [clientId, version], {
    enabled: !skipWorkoutRefresh,
  });

  const isDayLoaded = loadedDateKey === dateKey;
  const workoutForDay = isDayLoaded ? workout : null;
  const patchedComplete = isWorkoutCompletedFromPatches(patches, dateKey);
  const patchedSessionId = patches.workoutSessionIds[dateKey];
  const workoutCompletedForDay =
    isDayLoaded && (workoutCompleted || patchedComplete);
  const displayWorkout = workoutForDay ?? (patchedComplete ? workout : null);
  const showCompletedState = workoutCompletedForDay || patchedComplete;

  useEffect(() => {
    if (!patchedSessionId || workoutResults) return;
    let cancelled = false;
    void getCompletedWorkoutResultsForSession(patchedSessionId).then((results) => {
      if (!cancelled && results) setWorkoutResults(results);
    });
    return () => {
      cancelled = true;
    };
  }, [patchedSessionId, workoutResults]);

  useEffect(() => {
    if (!showCompletedState || workoutResults) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function attempt(retryIndex: number) {
      if (cancelled) return;
      const results = await loadWorkoutResults(
        clientId,
        dateKey,
        patches.workoutSessionIds[dateKey]
      );
      if (cancelled) return;
      if (results) {
        setWorkoutResults(results);
        return;
      }
      const nextIndex = retryIndex + 1;
      if (nextIndex < WORKOUT_RESULTS_RETRY_MS.length) {
        retryTimer = setTimeout(
          () => void attempt(nextIndex),
          WORKOUT_RESULTS_RETRY_MS[nextIndex]
        );
      }
    }

    void attempt(0);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    showCompletedState,
    workoutResults,
    clientId,
    dateKey,
    patchedSessionId,
    patches.workoutSessionIds,
  ]);

  const workoutMissed =
    !!workoutForDay &&
    !workoutCompletedForDay &&
    isDeadlinePassed(WORKOUT_DEADLINE, dateKey);

  const startDisabled = !displayWorkout || (!isDayLoaded && !patchedComplete);
  const { start: startWorkout, isStarting: isStartingWorkout } = useStartTodaysWorkout(
    selectedDate,
    startDisabled
  );

  const workoutChromeActions = useMemo(
    () =>
      variant === "detail"
        ? {
            onStartWorkout: startWorkout,
            showStart: !showCompletedState && !!displayWorkout,
            showCompleted: showCompletedState && !!displayWorkout,
            disabled: startDisabled,
            isStarting: isStartingWorkout,
            difficultyExercises:
              displayWorkout && displayWorkout.exercises.length > 0
                ? displayWorkout.exercises
                : null,
            intakeProfile,
          }
        : null,
    [
      variant,
      startWorkout,
      showCompletedState,
      displayWorkout,
      startDisabled,
      isStartingWorkout,
      intakeProfile,
    ]
  );
  useRegisterWorkoutPageChrome(workoutChromeActions);

  const estimatedDurationLabel =
    displayWorkout && displayWorkout.exercises.length > 0
      ? platform.workout.estTotal(
          formatWorkoutDurationShort(
            estimateWorkoutDurationSeconds(
              displayWorkout.exercises.map((exercise) => ({
                target_sets: exercise.sets,
              }))
            )
          )
        )
      : null;

  if (variant === "compact") {
    const hasMuscleMap =
      !!displayWorkout && displayWorkout.exercises.length > 0;

    return (
      <>
      <Card
        id="dashboard-workout"
        className="relative flex h-full min-h-[15rem] w-full cursor-pointer flex-col p-4 pt-12 sm:min-h-[16rem] transition-opacity hover:opacity-95 active:opacity-90"
      >
        <DashboardCardNavLink
          href={DASHBOARD_DAY_WORKOUT_PATH}
          ariaLabel={platform.trainTabs.workout}
        />
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground"
            onClick={() => setChangeWorkoutOpen(true)}
            aria-label="Change workout"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {showCompletedState && displayWorkout ? (
            <DashboardStatusCheck aria-label={platform.aria.completed} />
          ) : (
            <StartTodaysWorkoutButton
              date={selectedDate}
              disabled={!displayWorkout || (!isDayLoaded && !patchedComplete)}
            />
          )}
        </div>

        <div
          className={cn(
            "absolute inset-x-4 top-4 z-10 flex min-w-0 items-center gap-2 pr-16"
          )}
        >
          <Dumbbell className="h-5 w-5 shrink-0 text-primary" />
          <span className="shrink-0 text-lg font-black leading-none">
            {platform.trainTabs.workout}
          </span>
        </div>

        <DashboardCardNavBody className="grid min-h-0 flex-1 grid-cols-[minmax(7.25rem,34%)_1fr] items-stretch gap-2">
          <div className="relative flex min-h-[10rem] items-stretch">
            {hasMuscleMap ? (
              <WorkoutMuscleMap
                variant="compact"
                exercises={displayWorkout.exercises}
                dayTitle={displayWorkout.dayTitle}
                gender={gender}
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full min-h-[10rem] w-full items-center justify-center">
                <Dumbbell
                  className="h-10 w-10 text-muted-foreground/40 sm:h-11 sm:w-11"
                  aria-hidden
                />
              </div>
            )}
          </div>

          <div className="flex min-h-0 min-w-0 flex-col pr-6">
            {displayWorkout ? (
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-base font-bold leading-snug",
                    showCompletedState && "text-muted-foreground line-through"
                  )}
                >
                  {displayWorkout.dayTitle}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-sm text-muted-foreground",
                    showCompletedState && "line-through"
                  )}
                >
                  {displayWorkout.planTitle}
                  {!showCompletedState && displayWorkout.exercises.length > 0
                    ? ` · ${platform.common.exercises(displayWorkout.exercises.length)}`
                    : null}
                </p>
                {displayWorkout.exercises.length > 0 ? (
                  <>
                    <DashboardWorkoutCompactStats
                      exercises={displayWorkout.exercises}
                      className="mt-2"
                    />
                    <div className={cn("mt-2", dashboardInteractive)}>
                      <WorkoutDifficultyInsightButton
                        exercises={displayWorkout.exercises}
                        intakeProfile={intakeProfile}
                        size="compact"
                      />
                    </div>
                  </>
                ) : null}
              </div>
            ) : isDayLoaded ? (
              <p className="text-sm text-muted-foreground">{coachLabels.noWorkoutToday}</p>
            ) : null}
          </div>
        </DashboardCardNavBody>

        <ChevronRight
          className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 text-muted-foreground"
          aria-hidden
        />
      </Card>
      <ChangeWorkoutDialog
        open={changeWorkoutOpen}
        onClose={() => setChangeWorkoutOpen(false)}
        planId={displayWorkout?.planId}
      />
      </>
    );
  }

  if (variant === "detail") {
    return (
      <div id="dashboard-workout" className={dashboard.section}>
        <div className="hidden items-center justify-end gap-2 lg:flex">
          {showCompletedState && displayWorkout ? (
            <DashboardStatusCheck aria-label={platform.aria.completed} />
          ) : displayWorkout ? (
            <StartTodaysWorkoutButton
              date={selectedDate}
              disabled={startDisabled}
              display="text"
            />
          ) : null}
        </div>
        {displayWorkout ? (
          <>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className={cn(
                    dashboard.pageTitle,
                    showCompletedState && "text-muted-foreground line-through"
                  )}
                >
                  {displayWorkout.dayTitle}
                </h1>
                {displayWorkout.exercises.length > 0 ? (
                  <WorkoutDifficultyInsightButton
                    exercises={displayWorkout.exercises}
                    intakeProfile={intakeProfile}
                    size="compact"
                  />
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {displayWorkout.planTitle}
                {displayWorkout.exercises.length > 0 &&
                  ` · ${platform.common.exercises(displayWorkout.exercises.length)}`}
              </p>
              {estimatedDurationLabel ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{estimatedDurationLabel}</p>
              ) : null}
            </div>

            <div className={cn(dashboard.tile, "p-4 sm:p-5")}>
              <WorkoutMuscleMap
                exercises={displayWorkout.exercises}
                dayTitle={displayWorkout.dayTitle}
                gender={gender}
              />
            </div>

            {showCompletedState ? (
              workoutResults ? (
                <WorkoutResultsDropdown results={workoutResults} variant="open" />
              ) : (
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
              )
            ) : (
              <WorkoutExerciseList exercises={displayWorkout.exercises} />
            )}
          </>
        ) : isDayLoaded ? (
          <DashboardEmptyState>{coachLabels.noWorkoutToday}</DashboardEmptyState>
        ) : null}
      </div>
    );
  }

  return (
    <Card id="dashboard-workout">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          {platform.dashboard.todaysWorkout}
          <MissedButton
            count={workoutForDay && !workoutCompletedForDay && workoutMissed ? 1 : 0}
            title={coachLabels.missedWorkout}
            hint={coachLabels.workoutMissedHint}
            items={
              workoutForDay && workoutMissed
                ? [
                    {
                      id: "workout",
                      label: workoutForDay.dayTitle,
                      detail: `${workoutForDay.planTitle} · was due by ${WORKOUT_DEADLINE}`,
                    },
                  ]
                : []
            }
          />
        </CardTitle>
        {showCompletedState && displayWorkout ? (
          <DashboardStatusCheck aria-label={platform.aria.completed} />
        ) : (
          <StartTodaysWorkoutButton
            date={selectedDate}
            disabled={!displayWorkout || (!isDayLoaded && !patchedComplete)}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {displayWorkout ? (
          <>
            <div>
              <p
                className={cn(
                  "font-semibold",
                  showCompletedState && "text-muted-foreground line-through"
                )}
              >
                {displayWorkout.dayTitle}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {displayWorkout.planTitle}
                {displayWorkout.exercises.length > 0 &&
                  ` · ${platform.common.exercises(displayWorkout.exercises.length)}`}
                {showCompletedState
                  ? ` ${platform.workout.completedSuffix}`
                  : ` ${platform.workout.completeBy(WORKOUT_DEADLINE)}`}
              </p>
              {!showCompletedState ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {displayWorkout.exercises.slice(0, 3).map((ex) => (
                    <Badge key={ex.id} variant="secondary">
                      {ex.name}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            <WorkoutMuscleMap
              exercises={displayWorkout.exercises}
              dayTitle={displayWorkout.dayTitle}
              gender={gender}
            />
            {showCompletedState ? (
              <div>
                {workoutResults ? (
                  <WorkoutResultsDropdown results={workoutResults} />
                ) : (
                  <div
                    className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/80 px-3 py-3 text-sm text-muted-foreground sm:px-4"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    <span className="coach-alex-nav-loading__pulse-dot" />
                    <span className="coach-alex-nav-loading__pulse-dot" />
                    <span className="coach-alex-nav-loading__pulse-dot" />
                  </div>
                )}
              </div>
            ) : null}
          </>
        ) : isDayLoaded ? (
          <DashboardEmptyState>{coachLabels.noWorkoutToday}</DashboardEmptyState>
        ) : null}
      </CardContent>
    </Card>
  );
}
