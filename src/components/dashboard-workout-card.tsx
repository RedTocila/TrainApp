"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import { Check, Dumbbell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardDateFetch } from "@/components/dashboard-date-loading";
import { useDashboardSync } from "@/components/dashboard-sync";
import { isWorkoutCompletedFromPatches } from "@/lib/dashboard-enrichment-utils";
import { StartTodaysWorkoutButton } from "@/components/start-todays-workout-button";
import {
  SectionCompletedBadge,
  sectionCompletedCardClass,
} from "@/components/section-completed-badge";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MissedButton } from "@/components/missed-items-dialog";
import {
  isDeadlinePassed,
  WORKOUT_DEADLINE,
} from "@/lib/meal-times";

const WORKOUT_RESULTS_RETRY_MS = [0, 400, 800, 1500, 2500, 4000, 6000];

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
  initialWorkout,
  initialWorkoutCompleted = false,
  initialWorkoutResults = null,
}: {
  clientId: string;
  gender?: string | null;
  initialWorkout: TodaysWorkoutInfo | null;
  initialWorkoutCompleted?: boolean;
  initialWorkoutResults?: CompletedWorkoutResults | null;
}) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const { selectedDate, todayKey } = useSelectedDate();
  const { version, patches } = useDashboardSync();
  const dateKey = formatDateKey(selectedDate);
  const [workout, setWorkout] = useState(initialWorkout);
  const [workoutCompleted, setWorkoutCompleted] = useState(
    initialWorkoutCompleted
  );
  const [workoutResults, setWorkoutResults] =
    useState<CompletedWorkoutResults | null>(initialWorkoutResults);

  // Sync SSR props only when the server revalidates.
  useEffect(() => {
    setWorkout(initialWorkout);
    setWorkoutCompleted(initialWorkoutCompleted);
    if (initialWorkoutResults) setWorkoutResults(initialWorkoutResults);
  }, [initialWorkout, initialWorkoutCompleted, initialWorkoutResults]);

  const prevDateKeyRef = useRef(dateKey);
  useEffect(() => {
    if (prevDateKeyRef.current === dateKey) return;
    prevDateKeyRef.current = dateKey;
    setWorkoutResults(null);
  }, [dateKey]);

  const refreshWorkout = useCallback(async () => {
    const dateKey = formatDateKey(selectedDate);
    const [resolved, completed] = await Promise.all([
      resolveWorkoutForDate(clientId, dateKey),
      isWorkoutCompletedOnDate(clientId, dateKey),
    ]);
    setWorkout(resolved);
    setWorkoutCompleted(completed);
    const dayComplete =
      completed || isWorkoutCompletedFromPatches(patches, dateKey);
    if (dayComplete) {
      const results = await loadWorkoutResults(
        clientId,
        dateKey,
        patches.workoutSessionIds[dateKey]
      );
      if (results) setWorkoutResults(results);
    } else {
      setWorkoutResults(null);
    }
  }, [clientId, selectedDate, patches]);

  const isReady = useDashboardDateFetch(dateKey, refreshWorkout, [
    clientId,
    version,
    todayKey,
  ]);

  const workoutForDay = isReady ? workout : null;
  const patchedComplete = isWorkoutCompletedFromPatches(patches, dateKey);
  const patchedSessionId = patches.workoutSessionIds[dateKey];
  const workoutCompletedForDay =
    isReady && (workoutCompleted || patchedComplete);
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

  return (
    <Card
      id="dashboard-workout"
      className={sectionCompletedCardClass(showCompletedState && !!displayWorkout)}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          {platform.dashboard.todaysWorkout}
          {showCompletedState && displayWorkout && <SectionCompletedBadge />}
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
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-green-500 bg-green-500 text-white"
            aria-label={platform.aria.completed}
          >
            <Check className="h-4 w-4" />
          </span>
        ) : (
          <StartTodaysWorkoutButton
            date={selectedDate}
            disabled={!displayWorkout || (!isReady && !patchedComplete)}
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
                  showCompletedState && "text-green-400"
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
                    className="flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/5 px-3 py-3 text-sm text-muted-foreground sm:px-4"
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
        ) : isReady ? (
          <p className="text-sm text-muted-foreground">
            {coachLabels.noWorkoutToday}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
