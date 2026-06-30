"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { ChevronRight, Dumbbell } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelectedDate, useIsPastSelectedDay } from "@/components/date-provider";
import { useDashboardDateFetch } from "@/components/dashboard-date-loading";
import { useDashboardSync } from "@/components/dashboard-sync";
import { useOptionalDashboardEnrichment } from "@/components/dashboard-enrichment-provider";
import { StartTodaysWorkoutButton } from "@/components/start-todays-workout-button";
import { DashboardWorkoutCompactRow } from "@/components/dashboard-workout-compact-row";
import { DashboardWorkoutDetailSection } from "@/components/dashboard-workout-detail-section";
import {
  DashboardStatusCheck,
} from "@/components/section-completed-badge";
import { dashboard, DashboardEmptyState } from "@/components/dashboard-ui";
import {
  resolveWorkoutsForDate,
  getWorkoutCompletionStatusForDate,
  getCompletedWorkoutResultsForDate,
  getCompletedWorkoutResultsForSession,
  type TodaysWorkoutInfo,
  type CompletedWorkoutResults,
} from "@/lib/actions/workout-sessions";
import { WorkoutResultsDropdown } from "@/components/workout-results-dropdown";
import { WorkoutExerciseList } from "@/components/workout-exercise-list";
import { WorkoutMuscleMap } from "@/components/workout-muscle-map";
import { formatDateKey, cn } from "@/lib/utils";
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
import type { ClientSchedule } from "@/lib/daily-tasks";
import {
  resolveWorkoutsFromSchedule,
  workoutCompletionFromEnrichment,
} from "@/lib/resolve-workouts-from-schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardWorkoutPlusMenu } from "@/components/dashboard-workout-plus-menu";
import { AddWorkoutToDayDialog } from "@/components/add-workout-to-day-dialog";
import { RemoveWorkoutFromDayDialog } from "@/components/remove-workout-from-day-dialog";
import { MissedButton } from "@/components/missed-items-dialog";
import {
  isDeadlinePassed,
  WORKOUT_DEADLINE,
} from "@/lib/meal-times";
import type { Profile } from "@/lib/types";

const WORKOUT_RESULTS_RETRY_MS = [0, 400, 800, 1500, 2500, 4000, 6000];
const EMPTY_PATCHED_COMPLETIONS: Record<string, boolean> = {};

function workoutNavKey(workout: TodaysWorkoutInfo) {
  return workout.scheduledWorkoutId ?? workout.taskId;
}

type WorkoutDayCache = {
  workouts: TodaysWorkoutInfo[];
  completedByTaskId: Record<string, boolean>;
  sessionIdByTaskId: Record<string, string | null>;
  allCompleted: boolean;
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
  initialWorkouts,
  initialWorkoutCompleted = false,
  initialWorkoutResults = null,
  selectedWorkoutKey = null,
  variant = "full",
  schedule,
}: {
  clientId: string;
  gender?: string | null;
  intakeProfile?: Pick<Profile, "age" | "intake_responses"> | null;
  initialWorkout: TodaysWorkoutInfo | null;
  initialWorkouts?: TodaysWorkoutInfo[];
  initialWorkoutCompleted?: boolean;
  initialWorkoutResults?: CompletedWorkoutResults | null;
  selectedWorkoutKey?: string | null;
  variant?: "full" | "compact" | "detail";
  schedule?: ClientSchedule;
}) {
  const seedWorkouts = initialWorkouts ?? (initialWorkout ? [initialWorkout] : []);
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const router = useRouter();
  const { selectedDate, todayKey } = useSelectedDate();
  const readOnly = useIsPastSelectedDay();
  const enrichment = useOptionalDashboardEnrichment()?.enrichment;
  const { version, patches } = useDashboardSync();
  const dateKey = formatDateKey(selectedDate);
  const [workouts, setWorkouts] = useState(seedWorkouts);
  const [completedByTaskId, setCompletedByTaskId] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        seedWorkouts.map((workout) => [
          workout.taskId,
          initialWorkoutCompleted,
        ])
      )
  );
  const [sessionIdByTaskId, setSessionIdByTaskId] = useState<
    Record<string, string | null>
  >({});
  const [selectedCompactWorkoutKey, setSelectedCompactWorkoutKey] = useState<
    string | null
  >(null);
  const [workoutResults, setWorkoutResults] =
    useState<CompletedWorkoutResults | null>(initialWorkoutResults);
  const [loadedDateKey, setLoadedDateKey] = useState(dateKey);
  const [addWorkoutOpen, setAddWorkoutOpen] = useState(false);
  const [removeWorkoutOpen, setRemoveWorkoutOpen] = useState(false);
  const workoutCacheRef = useRef<Map<string, WorkoutDayCache>>(new Map());

  const seedFromSchedule = useCallback(
    (key: string): WorkoutDayCache | null => {
      if (!schedule) return null;
      const date = new Date(`${key}T12:00:00`);
      const resolved = resolveWorkoutsFromSchedule(date, schedule);
      const completedByTaskId = workoutCompletionFromEnrichment(
        resolved,
        enrichment?.completionsByDate[key]
      );
      const allCompleted =
        resolved.length > 0 &&
        resolved.every((workout) => completedByTaskId[workout.taskId]);
      return {
        workouts: resolved,
        completedByTaskId,
        sessionIdByTaskId: {},
        allCompleted,
        results: null,
      };
    },
    [schedule, enrichment?.completionsByDate]
  );

  useEffect(() => {
    router.prefetch(DASHBOARD_DAY_WORKOUT_PATH);
  }, [router]);

  useEffect(() => {
    const snapshot: WorkoutDayCache = {
      workouts: seedWorkouts,
      completedByTaskId: Object.fromEntries(
        seedWorkouts.map((workout) => [workout.taskId, initialWorkoutCompleted])
      ),
      sessionIdByTaskId: {},
      allCompleted: initialWorkoutCompleted,
      results: initialWorkoutResults,
    };
    workoutCacheRef.current.set(dateKey, snapshot);
    setWorkoutDayCache(clientId, dateKey, snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed SSR snapshot once
  }, []);

  useEffect(() => {
    if (dateKey !== todayKey) return;
    const snapshot: WorkoutDayCache = {
      workouts: seedWorkouts,
      completedByTaskId: Object.fromEntries(
        seedWorkouts.map((workout) => [workout.taskId, initialWorkoutCompleted])
      ),
      sessionIdByTaskId: {},
      allCompleted: initialWorkoutCompleted,
      results: initialWorkoutResults,
    };
    workoutCacheRef.current.set(dateKey, snapshot);
    setWorkoutDayCache(clientId, dateKey, snapshot);
    setWorkouts(snapshot.workouts);
    setCompletedByTaskId(snapshot.completedByTaskId);
    if (initialWorkoutResults) setWorkoutResults(initialWorkoutResults);
    setLoadedDateKey(dateKey);
  }, [
    seedWorkouts,
    initialWorkoutCompleted,
    initialWorkoutResults,
    dateKey,
    todayKey,
    clientId,
  ]);

  const prevDateKeyRef = useRef(dateKey);
  useEffect(() => {
    if (prevDateKeyRef.current === dateKey) return;
    prevDateKeyRef.current = dateKey;
    setSelectedCompactWorkoutKey(null);

    const cached = workoutCacheRef.current.get(dateKey);
    if (cached) {
      setWorkouts(cached.workouts);
      setCompletedByTaskId(cached.completedByTaskId);
      setSessionIdByTaskId(cached.sessionIdByTaskId);
      setWorkoutResults(cached.results);
      setLoadedDateKey(dateKey);
      return;
    }

    const shared = getWorkoutDayCache(clientId, dateKey);
    if (shared) {
      workoutCacheRef.current.set(dateKey, {
        ...shared,
        sessionIdByTaskId: shared.sessionIdByTaskId ?? {},
      });
      setWorkouts(shared.workouts);
      setCompletedByTaskId(shared.completedByTaskId);
      setSessionIdByTaskId(shared.sessionIdByTaskId ?? {});
      setWorkoutResults(shared.results);
      setLoadedDateKey(dateKey);
      return;
    }

    const scheduleSeed = seedFromSchedule(dateKey);
    if (scheduleSeed) {
      workoutCacheRef.current.set(dateKey, scheduleSeed);
      setWorkouts(scheduleSeed.workouts);
      setCompletedByTaskId(scheduleSeed.completedByTaskId);
      setSessionIdByTaskId(scheduleSeed.sessionIdByTaskId);
      setWorkoutResults(scheduleSeed.results);
      setLoadedDateKey(dateKey);
      return;
    }

    setWorkouts([]);
    setCompletedByTaskId({});
    setSessionIdByTaskId({});
    setWorkoutResults(null);
    setLoadedDateKey(dateKey);
  }, [clientId, dateKey, seedFromSchedule]);

  useEffect(() => {
    if (workouts.length > 0) return;
    const seed = seedFromSchedule(dateKey);
    if (!seed?.workouts.length) return;

    workoutCacheRef.current.set(dateKey, seed);
    setWorkoutDayCache(clientId, dateKey, seed);
    setWorkouts(seed.workouts);
    setCompletedByTaskId(seed.completedByTaskId);
    setSessionIdByTaskId(seed.sessionIdByTaskId);
    setWorkoutResults(seed.results);
    setLoadedDateKey(dateKey);
  }, [clientId, dateKey, workouts.length, seedFromSchedule]);

  const refreshWorkout = useCallback(async () => {
    const key = formatDateKey(selectedDate);
    const resolved = await resolveWorkoutsForDate(clientId, key);
    if (formatDateKey(selectedDate) !== key) return;

    const status = await getWorkoutCompletionStatusForDate(
      clientId,
      key,
      resolved
    );
    const allCompleted =
      resolved.length > 0 &&
      resolved.every((workout) => status[workout.taskId]?.completed);

    const completedMap = Object.fromEntries(
      Object.entries(status).map(([taskId, entry]) => [taskId, entry.completed])
    );
    const sessionMap = Object.fromEntries(
      Object.entries(status).map(([taskId, entry]) => [taskId, entry.sessionId])
    );
    const previous = workoutCacheRef.current.get(key);

    workoutCacheRef.current.set(key, {
      workouts: resolved,
      completedByTaskId: completedMap,
      sessionIdByTaskId: sessionMap,
      allCompleted,
      results: allCompleted ? (previous?.results ?? null) : null,
    });
    setWorkoutDayCache(clientId, key, workoutCacheRef.current.get(key)!);

    setWorkouts(resolved);
    setCompletedByTaskId(completedMap);
    setSessionIdByTaskId(sessionMap);
    setLoadedDateKey(key);

    if (!allCompleted) {
      setWorkoutResults(null);
      return;
    }

    void loadWorkoutResults(clientId, key, patches.workoutSessionIds[key]).then(
      (results) => {
        if (formatDateKey(selectedDate) !== key) return;
        setWorkoutResults(results);
        const cached = workoutCacheRef.current.get(key);
        if (cached) cached.results = results;
      }
    );
  }, [clientId, selectedDate, patches]);

  const skipWorkoutRefresh =
    isDashboardDayCacheFresh(workoutDayCacheKey(clientId, dateKey)) &&
    getWorkoutDayCache(clientId, dateKey) !== undefined &&
    (variant === "detail" ||
      (variant === "compact" && dateKey === todayKey && seedWorkouts.length > 0));

  const isFetchSettled = useDashboardDateFetch(dateKey, refreshWorkout, [clientId, version], {
    enabled: !skipWorkoutRefresh,
  });

  const isDayLoaded = loadedDateKey === dateKey;
  const isRevalidating = !isFetchSettled;
  const workoutsForDay = workouts;
  const patchedCompletions =
    patches.completions[dateKey] ?? EMPTY_PATCHED_COMPLETIONS;

  const isTaskCompleted = useCallback(
    (taskId: string) =>
      completedByTaskId[taskId] === true || patchedCompletions[taskId] === true,
    [completedByTaskId, patchedCompletions]
  );

  const getWorkoutSessionId = useCallback(
    (taskId: string) =>
      patches.workoutSessionIds[taskId] ?? sessionIdByTaskId[taskId] ?? null,
    [patches.workoutSessionIds, sessionIdByTaskId]
  );

  const allWorkoutsComplete =
    workoutsForDay.length > 0 &&
    workoutsForDay.every((workout) => isTaskCompleted(workout.taskId));
  const completedWorkoutCount = workoutsForDay.filter((workout) =>
    isTaskCompleted(workout.taskId)
  ).length;
  const displayWorkout =
    workoutsForDay.find((workout) => !isTaskCompleted(workout.taskId)) ??
    workoutsForDay[0] ??
    null;
  const removableWorkoutCount = workoutsForDay.filter(
    (workout) => workout.scheduledWorkoutId
  ).length;
  const showCompletedState = allWorkoutsComplete;
  const resultsReady = variant !== "detail" && showCompletedState;
  const patchedSessionId =
    Object.values(patches.workoutSessionIds).find(Boolean) ??
    patches.workoutSessionIds[dateKey];

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
    if (!resultsReady || workoutResults) return;

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
    resultsReady,
    workoutResults,
    clientId,
    dateKey,
    patchedSessionId,
    patches.workoutSessionIds,
  ]);

  const workoutMissed =
    workoutsForDay.length > 0 &&
    !allWorkoutsComplete &&
    isDeadlinePassed(WORKOUT_DEADLINE, dateKey);

  const compactSelectedWorkout = useMemo(() => {
    if (selectedCompactWorkoutKey) {
      const match = workoutsForDay.find(
        (workout) => workoutNavKey(workout) === selectedCompactWorkoutKey
      );
      if (match) return match;
    }
    return displayWorkout;
  }, [selectedCompactWorkoutKey, workoutsForDay, displayWorkout]);

  if (variant === "compact") {
    const muscleMapExercises = compactSelectedWorkout?.exercises ?? [];
    const hasMuscleMap = muscleMapExercises.length > 0;
    const selectedKey = compactSelectedWorkout
      ? workoutNavKey(compactSelectedWorkout)
      : null;

    return (
      <>
      <Card
        id="dashboard-workout"
        className="relative flex w-full cursor-pointer flex-col p-4 pt-12 transition-opacity hover:opacity-95 active:opacity-90"
      >
        <DashboardCardNavLink
          href={DASHBOARD_DAY_WORKOUT_PATH}
          ariaLabel={platform.trainTabs.workout}
        />
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
          {!readOnly ? (
            <DashboardWorkoutPlusMenu
              className={dashboardInteractive}
              canRemove={removableWorkoutCount > 0}
              onAddWorkout={() => setAddWorkoutOpen(true)}
              onRemoveWorkout={() => setRemoveWorkoutOpen(true)}
            />
          ) : null}
          <ChevronRight
            className="pointer-events-none h-4 w-4 text-muted-foreground"
            aria-hidden
          />
          {showCompletedState && workoutsForDay.length > 0 ? (
            <DashboardStatusCheck aria-label={platform.aria.completed} />
          ) : null}
        </div>

        <div
          className={cn(
            "absolute inset-x-4 top-4 z-10 flex min-w-0 items-center gap-2 pr-24"
          )}
        >
          <Dumbbell className="h-5 w-5 shrink-0 text-primary" />
          <span className="shrink-0 text-lg font-black leading-none">
            {platform.trainTabs.workout}
          </span>
          {workoutsForDay.length > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              {completedWorkoutCount}/{workoutsForDay.length}
            </Badge>
          ) : null}
        </div>

        <DashboardCardNavBody className="flex min-h-0 flex-1 flex-col gap-3">
          {hasMuscleMap && compactSelectedWorkout ? (
            <div className="relative w-full">
              <WorkoutMuscleMap
                key={selectedKey ?? compactSelectedWorkout.taskId}
                variant="compact"
                exercises={muscleMapExercises}
                dayTitle={compactSelectedWorkout.dayTitle}
                gender={gender}
              />
            </div>
          ) : workoutsForDay.length > 0 ? (
            <div className="flex w-full items-center justify-center py-6">
              <Dumbbell
                className="h-10 w-10 text-muted-foreground/40 sm:h-11 sm:w-11"
                aria-hidden
              />
            </div>
          ) : isRevalidating ? (
            <div className="flex w-full flex-col items-center justify-center gap-2 py-8">
              <Dumbbell className="h-10 w-10 animate-pulse text-muted-foreground/30" aria-hidden />
              <p className="text-xs text-muted-foreground">{platform.common.loading}</p>
            </div>
          ) : null}

          {workoutsForDay.length > 0 ? (
            <ul className={cn("flex flex-col gap-2", dashboardInteractive)}>
              {workoutsForDay.map((workout) => {
                const workoutKey = workoutNavKey(workout);
                return (
                  <DashboardWorkoutCompactRow
                    key={workout.taskId}
                    workout={workout}
                    workoutKey={workoutKey}
                    selected={workoutKey === selectedKey}
                    done={isTaskCompleted(workout.taskId)}
                    isDayLoaded={isDayLoaded}
                    selectedDate={selectedDate}
                    onSelect={setSelectedCompactWorkoutKey}
                    readOnly={readOnly}
                  />
                );
              })}
            </ul>
          ) : isDayLoaded ? (
            <p className="text-sm text-muted-foreground">{coachLabels.noWorkoutToday}</p>
          ) : isRevalidating ? (
            <p className="text-sm text-muted-foreground">{platform.common.loading}</p>
          ) : null}
        </DashboardCardNavBody>
      </Card>
      <AddWorkoutToDayDialog
        open={addWorkoutOpen}
        onClose={() => setAddWorkoutOpen(false)}
        dateKey={dateKey}
        onAdded={() => void refreshWorkout()}
      />
      <RemoveWorkoutFromDayDialog
        open={removeWorkoutOpen}
        onClose={() => setRemoveWorkoutOpen(false)}
        dateKey={dateKey}
        workouts={workoutsForDay}
        onRemoved={() => void refreshWorkout()}
      />
      </>
    );
  }

  if (variant === "detail") {
    return (
      <>
        <div id="dashboard-workout" className={dashboard.section}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className={dashboard.pageTitle}>{platform.trainTabs.workout}</h1>
              {workoutsForDay.length > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="tabular-nums">
                    {completedWorkoutCount}/{workoutsForDay.length}
                  </span>{" "}
                  {platform.common.completed.toLowerCase()}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!readOnly ? (
                <DashboardWorkoutPlusMenu
                  canRemove={removableWorkoutCount > 0}
                  onAddWorkout={() => setAddWorkoutOpen(true)}
                  onRemoveWorkout={() => setRemoveWorkoutOpen(true)}
                />
              ) : null}
            </div>
          </div>

          {workoutsForDay.length > 0 ? (
            <div className="space-y-4">
              {workoutsForDay.map((workout) => {
                const workoutKey = workoutNavKey(workout);
                return (
                  <DashboardWorkoutDetailSection
                    key={workout.taskId}
                    workout={workout}
                    workoutKey={workoutKey}
                    highlighted={selectedWorkoutKey === workoutKey}
                    done={isTaskCompleted(workout.taskId)}
                    isDayLoaded={isDayLoaded}
                    selectedDate={selectedDate}
                    sessionId={getWorkoutSessionId(workout.taskId)}
                    gender={gender}
                    intakeProfile={intakeProfile}
                    readOnly={readOnly}
                  />
                );
              })}
            </div>
          ) : isDayLoaded ? (
            <DashboardEmptyState>{coachLabels.noWorkoutToday}</DashboardEmptyState>
          ) : null}
        </div>
        <AddWorkoutToDayDialog
          open={addWorkoutOpen}
          onClose={() => setAddWorkoutOpen(false)}
          dateKey={dateKey}
          onAdded={() => void refreshWorkout()}
        />
        <RemoveWorkoutFromDayDialog
          open={removeWorkoutOpen}
          onClose={() => setRemoveWorkoutOpen(false)}
          dateKey={dateKey}
          workouts={workoutsForDay}
          onRemoved={() => void refreshWorkout()}
        />
      </>
    );
  }

  return (
    <Card id="dashboard-workout">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          {platform.dashboard.todaysWorkout}
          <MissedButton
            count={
              workoutsForDay.filter(
                (workout) => !isTaskCompleted(workout.taskId) && workoutMissed
              ).length
            }
            title={coachLabels.missedWorkout}
            hint={coachLabels.workoutMissedHint}
            items={workoutsForDay
              .filter((workout) => !isTaskCompleted(workout.taskId) && workoutMissed)
              .map((workout) => ({
                id: workout.taskId,
                label: workout.dayTitle,
                detail: `${workout.planTitle} · was due by ${WORKOUT_DEADLINE}`,
              }))}
          />
        </CardTitle>
        {showCompletedState && displayWorkout ? (
          <DashboardStatusCheck aria-label={platform.aria.completed} />
        ) : (
          !readOnly ? (
            <StartTodaysWorkoutButton
              date={selectedDate}
              workout={displayWorkout}
              disabled={!isDayLoaded}
            />
          ) : null
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
            {!showCompletedState && displayWorkout.exercises.length > 0 ? (
              <WorkoutExerciseList
                exercises={displayWorkout.exercises}
                gender={gender}
                className="mt-2"
              />
            ) : null}
            {showCompletedState ? (
              <div>
                {workoutResults ? (
                  <WorkoutResultsDropdown results={workoutResults} gender={gender} />
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
