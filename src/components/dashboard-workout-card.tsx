"use client";
import { useCoachLabels, useLocale, usePlatformCopy } from "@/components/locale-provider";

import { Check, ChevronRight, Clock, Dumbbell, Flame, Layers, List, Play, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays } from "date-fns";
import { useSelectedDate, useIsPastSelectedDay } from "@/components/date-provider";
import { useDashboardDateFetch } from "@/components/dashboard-date-loading";
import { useDashboardSync } from "@/components/dashboard-sync";
import { useOptionalDashboardEnrichment } from "@/components/dashboard-enrichment-provider";
import { DashboardWorkoutMiniRow } from "@/components/dashboard-workout-mini-row";
import { DashboardWorkoutDetailSection, DashboardWorkoutDetailSkeleton } from "@/components/dashboard-workout-detail-section";
import { areMainWorkoutsComplete, hasIncompleteWorkoutExtras, isMainWorkoutKind, sortWorkoutsBySessionOrder } from "@/lib/hiit";
import {
  DashboardStatusIcon,
  dashboardCompletionStatus,
} from "@/components/section-completed-badge";
import { DashboardThemedShell } from "@/components/dashboard-themed-shell";
import { WorkoutDifficultyInsightButton } from "@/components/workout-difficulty-insight-button";
import { dashboard, DashboardEmptyState } from "@/components/dashboard-ui";
import { DASHBOARD_NAV_GLASS_CLASS } from "@/components/ai-coach-fab";
import {
  estimateWorkoutCaloriesKcal,
  estimateWorkoutDurationSeconds,
  formatWorkoutDurationShort,
} from "@/lib/workout-duration";
import {
  resolveWorkoutsForDate,
  getWorkoutCompletionStatusForDate,
  getCompletedWorkoutResultsForDate,
  getCompletedWorkoutResultsForSession,
  type TodaysWorkoutInfo,
  type CompletedWorkoutResults,
} from "@/lib/actions/workout-sessions";
import { formatLocalized } from "@/lib/date-locale";
import { formatDateKey, cn } from "@/lib/utils";
import { resolveDashboardWorkoutBackground, getDashboardRestDayBackgroundSrc } from "@/lib/workout-visual-categories";
import { DASHBOARD_DAY_WORKOUT_PATH } from "@/lib/dashboard-day-routes";
import {
  DashboardCardNavBody,
  DashboardCardNavLink,
  dashboardInteractive,
} from "@/components/dashboard-card-nav-link";
import {
  clearWorkoutDayCache,
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
import { buttonVariants } from "@/components/ui/button";
import { DashboardWorkoutPlusMenu } from "@/components/dashboard-workout-plus-menu";
import { StartTodaysWorkoutButton } from "@/components/start-todays-workout-button";
import { useRegisterWorkoutPageChrome } from "@/components/workout-page-chrome-context";
import { AddWorkoutToDayDialog } from "@/components/add-workout-to-day-dialog";
import { EditDayWorkoutsDialog } from "@/components/edit-day-workouts-dialog";
import { MissedButton } from "@/components/missed-items-dialog";
import {
  dayRelation,
  isDayEnded,
} from "@/lib/meal-times";
import type { Profile } from "@/lib/types";

const WORKOUT_RESULTS_RETRY_MS = [0, 400, 800, 1500, 2500, 4000, 6000];
const EMPTY_PATCHED_COMPLETIONS: Record<string, boolean> = {};

function workoutNavKey(workout: TodaysWorkoutInfo) {
  return workout.scheduledWorkoutId ?? workout.taskId;
}

function WorkoutHeroBodySkeleton({ onPhoto = false }: { onPhoto?: boolean }) {
  const bar = onPhoto ? "bg-white/20" : "bg-secondary/80";
  return (
    <div
      className="flex flex-1 flex-col gap-3"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className={cn("h-8 w-40 animate-pulse rounded-lg", bar)} />
      <div className="flex flex-col gap-2">
        <div className={cn("h-6 w-44 animate-pulse rounded-lg", bar)} />
        <div className={cn("h-6 w-36 animate-pulse rounded-lg", bar)} />
        <div className={cn("h-6 w-40 animate-pulse rounded-lg", bar)} />
        <div className={cn("h-6 w-32 animate-pulse rounded-lg", bar)} />
      </div>
      <div className={cn("mt-auto h-12 animate-pulse rounded-xl", bar)} />
    </div>
  );
}

function WorkoutListBodySkeleton() {
  return (
    <div
      className="mt-1 flex flex-col gap-2"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-14 w-full animate-pulse rounded-xl bg-secondary/80" />
      <div className="h-14 w-full animate-pulse rounded-xl bg-secondary/80" />
      <div className="h-14 w-full animate-pulse rounded-xl bg-secondary/70" />
    </div>
  );
}

type WorkoutDayCache = {
  workouts: TodaysWorkoutInfo[];
  completedByTaskId: Record<string, boolean>;
  skippedByTaskId: Record<string, boolean>;
  sessionIdByTaskId: Record<string, string | null>;
  allCompleted: boolean;
  results: CompletedWorkoutResults | null;
};

async function loadWorkoutResults(
  clientId: string,
  dateKey: string,
  sessionId?: string,
  timezoneOffsetMinutes = 0
): Promise<CompletedWorkoutResults | null> {
  if (sessionId) {
    const bySession = await getCompletedWorkoutResultsForSession(sessionId);
    if (bySession) return bySession;
  }
  return getCompletedWorkoutResultsForDate(
    clientId,
    dateKey,
    timezoneOffsetMinutes
  );
}

export function DashboardWorkoutCard({
  clientId,
  seedDateKey,
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
  seedDateKey?: string;
  gender?: string | null;
  intakeProfile?: Pick<Profile, "age" | "intake_responses"> | null;
  initialWorkout: TodaysWorkoutInfo | null;
  initialWorkouts?: TodaysWorkoutInfo[];
  initialWorkoutCompleted?: boolean;
  initialWorkoutResults?: CompletedWorkoutResults | null;
  selectedWorkoutKey?: string | null;
  variant?: "full" | "compact" | "detail" | "hero";
  schedule?: ClientSchedule;
}) {
  const seedWorkouts = initialWorkouts ?? (initialWorkout ? [initialWorkout] : []);
  const coachLabels = useCoachLabels();
  const locale = useLocale();
  const platform = usePlatformCopy();
  const router = useRouter();
  const { selectedDate, todayKey } = useSelectedDate();
  const readOnly = useIsPastSelectedDay();
  const enrichment = useOptionalDashboardEnrichment()?.enrichment;
  const { version, patches, notifySync } = useDashboardSync();
  const dateKey = formatDateKey(selectedDate);
  const isSeedDate = dateKey === (seedDateKey ?? todayKey);
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
  const [skippedByTaskId, setSkippedByTaskId] = useState<Record<string, boolean>>(
    {}
  );
  const [sessionIdByTaskId, setSessionIdByTaskId] = useState<
    Record<string, string | null>
  >({});
  const [workoutResults, setWorkoutResults] =
    useState<CompletedWorkoutResults | null>(initialWorkoutResults);
  const [loadedDateKey, setLoadedDateKey] = useState(() =>
    seedWorkouts.length > 0 ? dateKey : ""
  );
  const confirmedEmptyRef = useRef<Set<string>>(new Set());
  const [editWorkoutOpen, setEditWorkoutOpen] = useState(false);
  const [addWorkoutOpen, setAddWorkoutOpen] = useState(false);
  const [isUpdatingDay, setIsUpdatingDay] = useState(false);
  const workoutCacheRef = useRef<Map<string, WorkoutDayCache>>(new Map());
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const patchesRef = useRef(patches);
  patchesRef.current = patches;
  /** Scheduled workout ids removed optimistically — ignore until delete settles. */
  const pendingRemovedIdsRef = useRef<Set<string>>(new Set());

  const withoutPendingRemoved = useCallback(
    (list: TodaysWorkoutInfo[]) => {
      const pending = pendingRemovedIdsRef.current;
      if (pending.size === 0) return list;
      return list.filter(
        (w) => !w.scheduledWorkoutId || !pending.has(w.scheduledWorkoutId)
      );
    },
    []
  );

  const seedFromSchedule = useCallback(
    (key: string): WorkoutDayCache | null => {
      if (!schedule) return null;
      const date = new Date(`${key}T12:00:00`);
      const resolved = resolveWorkoutsFromSchedule(date, schedule);
      const completedByTaskId = workoutCompletionFromEnrichment(
        resolved,
        enrichment?.completionsByDate[key]
      );
      const allCompleted = areMainWorkoutsComplete(
        resolved,
        (taskId) => completedByTaskId[taskId] === true
      );
      return {
        workouts: resolved,
        completedByTaskId,
        skippedByTaskId: {},
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
    if (seedWorkouts.length === 0) return;
    const snapshot: WorkoutDayCache = {
      workouts: seedWorkouts,
      completedByTaskId: Object.fromEntries(
        seedWorkouts.map((workout) => [workout.taskId, initialWorkoutCompleted])
      ),
      skippedByTaskId: {},
      sessionIdByTaskId: {},
      allCompleted: initialWorkoutCompleted,
      results: initialWorkoutResults,
    };
    workoutCacheRef.current.set(dateKey, snapshot);
    setWorkoutDayCache(clientId, dateKey, snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed SSR snapshot once
  }, []);

  useEffect(() => {
    if (!isSeedDate) return;
    const seeded = withoutPendingRemoved(seedWorkouts);
    const snapshot: WorkoutDayCache = {
      workouts: seeded,
      completedByTaskId: Object.fromEntries(
        seeded.map((workout) => [workout.taskId, initialWorkoutCompleted])
      ),
      skippedByTaskId: {},
      sessionIdByTaskId: {},
      allCompleted:
        seeded.length > 0 &&
        areMainWorkoutsComplete(seeded, () => initialWorkoutCompleted),
      results:
        seeded.length > 0 && initialWorkoutCompleted
          ? initialWorkoutResults
          : null,
    };
    workoutCacheRef.current.set(dateKey, snapshot);
    setWorkoutDayCache(clientId, dateKey, snapshot);
    setWorkouts(snapshot.workouts);
    setCompletedByTaskId(snapshot.completedByTaskId);
    setSkippedByTaskId(snapshot.skippedByTaskId ?? {});
    setWorkoutResults(snapshot.results);
    setLoadedDateKey(dateKey);
  }, [
    seedWorkouts,
    initialWorkoutCompleted,
    initialWorkoutResults,
    dateKey,
    isSeedDate,
    clientId,
    withoutPendingRemoved,
  ]);

  const prevDateKeyRef = useRef(dateKey);
  useLayoutEffect(() => {
    if (prevDateKeyRef.current === dateKey) return;
    prevDateKeyRef.current = dateKey;
    setIsUpdatingDay(false);

    const applyCache = (cached: WorkoutDayCache, markLoaded: boolean) => {
      setWorkouts(cached.workouts);
      setCompletedByTaskId(cached.completedByTaskId);
      setSkippedByTaskId(cached.skippedByTaskId ?? {});
      setSessionIdByTaskId(cached.sessionIdByTaskId);
      setWorkoutResults(cached.results);
      if (markLoaded) setLoadedDateKey(dateKey);
    };

    const isPastDay = dateKey < todayKey;

    const cached = workoutCacheRef.current.get(dateKey);
    if (cached) {
      // Past empty cache may be a stale rest seed — wait for server refresh.
      const trustCache = !isPastDay || cached.workouts.length > 0;
      applyCache(cached, trustCache);
      if (trustCache) return;
    }

    const shared = getWorkoutDayCache(clientId, dateKey);
    if (shared) {
      const trustShared = !isPastDay || shared.workouts.length > 0;
      workoutCacheRef.current.set(dateKey, {
        ...shared,
        skippedByTaskId: shared.skippedByTaskId ?? {},
        sessionIdByTaskId: shared.sessionIdByTaskId ?? {},
      });
      applyCache(
        {
          ...shared,
          skippedByTaskId: shared.skippedByTaskId ?? {},
          sessionIdByTaskId: shared.sessionIdByTaskId ?? {},
        },
        trustShared
      );
      if (trustShared) return;
    }

    const scheduleSeed = seedFromSchedule(dateKey);
    if (scheduleSeed && scheduleSeed.workouts.length > 0) {
      workoutCacheRef.current.set(dateKey, scheduleSeed);
      applyCache(scheduleSeed, true);
      return;
    }

    // Clear previous day immediately so results/completions don't bleed across dates.
    setWorkouts([]);
    setCompletedByTaskId({});
    setSessionIdByTaskId({});
    setWorkoutResults(null);
    if (!isPastDay) {
      setLoadedDateKey(dateKey);
    }
  }, [clientId, dateKey, todayKey, seedFromSchedule]);

  useEffect(() => {
    if (workouts.length > 0) return;
    if (confirmedEmptyRef.current.has(dateKey)) return;
    const seed = seedFromSchedule(dateKey);
    if (!seed?.workouts.length) return;
    const filtered = withoutPendingRemoved(seed.workouts);
    if (filtered.length === 0) {
      confirmedEmptyRef.current.add(dateKey);
      return;
    }

    const snapshot: WorkoutDayCache = {
      ...seed,
      workouts: filtered,
      allCompleted: areMainWorkoutsComplete(
        filtered,
        (taskId) => seed.completedByTaskId[taskId] === true
      ),
    };
    workoutCacheRef.current.set(dateKey, snapshot);
    setWorkoutDayCache(clientId, dateKey, snapshot);
    setWorkouts(snapshot.workouts);
    setCompletedByTaskId(snapshot.completedByTaskId);
    setSkippedByTaskId(snapshot.skippedByTaskId ?? {});
    setSessionIdByTaskId(snapshot.sessionIdByTaskId);
    setWorkoutResults(snapshot.allCompleted ? snapshot.results : null);
    setLoadedDateKey(dateKey);
  }, [clientId, dateKey, workouts.length, seedFromSchedule, withoutPendingRemoved]);

  const refreshWorkout = useCallback(async () => {
    const key = formatDateKey(selectedDateRef.current);
    const timezoneOffsetMinutes = new Date().getTimezoneOffset();
    try {
      const resolvedRaw = await resolveWorkoutsForDate(
        clientId,
        key,
        timezoneOffsetMinutes
      );
      if (formatDateKey(selectedDateRef.current) !== key) return;

      const resolved = withoutPendingRemoved(resolvedRaw);

      const status = await getWorkoutCompletionStatusForDate(
        clientId,
        key,
        resolved
      );
      if (formatDateKey(selectedDateRef.current) !== key) return;

      if (resolved.length === 0) {
        confirmedEmptyRef.current.add(key);
      } else {
        confirmedEmptyRef.current.delete(key);
      }

      const allCompleted = areMainWorkoutsComplete(
        resolved,
        (taskId) => status[taskId]?.completed === true
      );

      const completedMap = Object.fromEntries(
        Object.entries(status).map(([taskId, entry]) => [taskId, entry.completed])
      );
      const skippedMap = Object.fromEntries(
        Object.entries(status).map(([taskId, entry]) => [taskId, entry.skipped === true])
      );
      const sessionMap = Object.fromEntries(
        Object.entries(status).map(([taskId, entry]) => [taskId, entry.sessionId])
      );
      const previous = workoutCacheRef.current.get(key);

      workoutCacheRef.current.set(key, {
        workouts: resolved,
        completedByTaskId: completedMap,
        skippedByTaskId: skippedMap,
        sessionIdByTaskId: sessionMap,
        allCompleted,
        results: allCompleted ? (previous?.results ?? null) : null,
      });
      setWorkoutDayCache(clientId, key, workoutCacheRef.current.get(key)!);

      setWorkouts(resolved);
      setCompletedByTaskId(completedMap);
      setSkippedByTaskId(skippedMap);
      setSessionIdByTaskId(sessionMap);

      if (!allCompleted || resolved.length === 0) {
        setWorkoutResults(null);
      } else {
        void loadWorkoutResults(
          clientId,
          key,
          patchesRef.current.workoutSessionIds[key],
          timezoneOffsetMinutes
        ).then((results) => {
          if (formatDateKey(selectedDateRef.current) !== key) return;
          setWorkoutResults(results);
          const cached = workoutCacheRef.current.get(key);
          if (cached) cached.results = results;
        });
      }
    } catch {
      // Still settle the day below so the UI never sticks on skeleton.
    } finally {
      if (formatDateKey(selectedDateRef.current) === key) {
        setLoadedDateKey(key);
      }
    }
  }, [clientId, withoutPendingRemoved]);

  useEffect(() => {
    if (dateKey !== todayKey) return;
    const timezoneOffsetMinutes = new Date().getTimezoneOffset();
    const adjacentKeys = [
      formatDateKey(addDays(selectedDate, -1)),
      formatDateKey(addDays(selectedDate, 1)),
    ];
    for (const key of adjacentKeys) {
      if (isDashboardDayCacheFresh(workoutDayCacheKey(clientId, key))) continue;
      void resolveWorkoutsForDate(clientId, key, timezoneOffsetMinutes)
        .then(async (resolved) => {
          const status = await getWorkoutCompletionStatusForDate(
            clientId,
            key,
            resolved
          );
          const allCompleted = areMainWorkoutsComplete(
            resolved,
            (taskId) => status[taskId]?.completed === true
          );
          const completedMap = Object.fromEntries(
            Object.entries(status).map(([taskId, entry]) => [taskId, entry.completed])
          );
          const skippedMap = Object.fromEntries(
            Object.entries(status).map(([taskId, entry]) => [taskId, entry.skipped === true])
          );
          const sessionMap = Object.fromEntries(
            Object.entries(status).map(([taskId, entry]) => [taskId, entry.sessionId])
          );
          const snapshot: WorkoutDayCache = {
            workouts: resolved,
            completedByTaskId: completedMap,
            skippedByTaskId: skippedMap,
            sessionIdByTaskId: sessionMap,
            allCompleted,
            results: null,
          };
          workoutCacheRef.current.set(key, snapshot);
          setWorkoutDayCache(clientId, key, snapshot);
        })
        .catch(() => {});
    }
  }, [clientId, dateKey, selectedDate, todayKey]);

  const handleWorkoutAdded = useCallback(() => {
    confirmedEmptyRef.current.delete(dateKey);
    workoutCacheRef.current.delete(dateKey);
    clearWorkoutDayCache(clientId, dateKey);
    setIsUpdatingDay(true);
    notifySync();
    router.refresh();
    void refreshWorkout().finally(() => {
      setIsUpdatingDay(false);
    });
  }, [clientId, dateKey, notifySync, refreshWorkout, router]);

  const handleWorkoutsRemoved = useCallback(
    (scheduledWorkoutIds: string[]) => {
      if (scheduledWorkoutIds.length === 0) return;
      const idSet = new Set(scheduledWorkoutIds);
      for (const id of scheduledWorkoutIds) {
        pendingRemovedIdsRef.current.add(id);
      }

      setWorkouts((prev) => {
        const removedTaskIds = new Set(
          prev
            .filter((w) => w.scheduledWorkoutId && idSet.has(w.scheduledWorkoutId))
            .map((w) => w.taskId)
        );
        const next = prev.filter(
          (w) => !w.scheduledWorkoutId || !idSet.has(w.scheduledWorkoutId)
        );

        setCompletedByTaskId((prevCompleted) => {
          if (removedTaskIds.size === 0) return prevCompleted;
          const nextCompleted = { ...prevCompleted };
          for (const taskId of removedTaskIds) delete nextCompleted[taskId];
          return nextCompleted;
        });
        setSkippedByTaskId((prevSkipped) => {
          if (removedTaskIds.size === 0) return prevSkipped;
          const nextSkipped = { ...prevSkipped };
          for (const taskId of removedTaskIds) delete nextSkipped[taskId];
          return nextSkipped;
        });
        setSessionIdByTaskId((prevSessions) => {
          if (removedTaskIds.size === 0) return prevSessions;
          const nextSessions = { ...prevSessions };
          for (const taskId of removedTaskIds) delete nextSessions[taskId];
          return nextSessions;
        });

        const allCompleted = areMainWorkoutsComplete(
          next,
          (taskId) =>
            !(removedTaskIds.has(taskId)) &&
            (workoutCacheRef.current.get(dateKey)?.completedByTaskId[taskId] ===
              true ||
              completedByTaskId[taskId] === true)
        );

        if (!allCompleted || next.length === 0) {
          setWorkoutResults(null);
        }

        const snapshot: WorkoutDayCache = {
          workouts: next,
          completedByTaskId: Object.fromEntries(
            Object.entries(
              workoutCacheRef.current.get(dateKey)?.completedByTaskId ??
                completedByTaskId
            ).filter(([taskId]) => !removedTaskIds.has(taskId))
          ),
          skippedByTaskId: Object.fromEntries(
            Object.entries(
              workoutCacheRef.current.get(dateKey)?.skippedByTaskId ??
                skippedByTaskId
            ).filter(([taskId]) => !removedTaskIds.has(taskId))
          ),
          sessionIdByTaskId: Object.fromEntries(
            Object.entries(
              workoutCacheRef.current.get(dateKey)?.sessionIdByTaskId ??
                sessionIdByTaskId
            ).filter(([taskId]) => !removedTaskIds.has(taskId))
          ),
          allCompleted,
          results: allCompleted && next.length > 0 ? workoutResults : null,
        };
        workoutCacheRef.current.set(dateKey, snapshot);
        setWorkoutDayCache(clientId, dateKey, snapshot);
        if (next.length === 0) confirmedEmptyRef.current.add(dateKey);
        return next;
      });
    },
    [
      clientId,
      completedByTaskId,
      dateKey,
      sessionIdByTaskId,
      skippedByTaskId,
      workoutResults,
    ]
  );

  const handleRemoveSettled = useCallback(
    (scheduledWorkoutIds: string[], ok: boolean) => {
      for (const id of scheduledWorkoutIds) {
        pendingRemovedIdsRef.current.delete(id);
      }
      if (!ok) {
        // Roll back optimistic UI from server truth.
        confirmedEmptyRef.current.delete(dateKey);
        workoutCacheRef.current.delete(dateKey);
        clearWorkoutDayCache(clientId, dateKey);
        setIsUpdatingDay(true);
        void refreshWorkout().finally(() => setIsUpdatingDay(false));
        return;
      }
      // Quiet reconcile — pending set is clear so fetch won't resurrect deletes.
      void refreshWorkout();
    },
    [clientId, dateKey, refreshWorkout]
  );

  const skipWorkoutRefresh =
    dateKey >= todayKey &&
    isDashboardDayCacheFresh(workoutDayCacheKey(clientId, dateKey)) &&
    (getWorkoutDayCache(clientId, dateKey)?.workouts.length ?? 0) > 0 &&
    (variant === "detail" ||
      ((variant === "compact" || variant === "hero") &&
        isSeedDate &&
        seedWorkouts.length > 0));

  const isFetchSettled = useDashboardDateFetch(dateKey, refreshWorkout, [clientId, version], {
    enabled: !skipWorkoutRefresh,
  });

  // If the fetch settled but loadedDateKey lagged (errors / races), unlock the UI.
  useEffect(() => {
    if (isFetchSettled && loadedDateKey !== dateKey) {
      setLoadedDateKey(dateKey);
    }
  }, [isFetchSettled, loadedDateKey, dateKey]);

  const isDayLoaded = loadedDateKey === dateKey;
  const isRevalidating = !isFetchSettled;
  const workoutsForDay = useMemo(
    () => sortWorkoutsBySessionOrder(workouts),
    [workouts]
  );
  const patchedCompletions =
    patches.completions[dateKey] ?? EMPTY_PATCHED_COMPLETIONS;

  const isTaskCompleted = useCallback(
    (taskId: string) =>
      completedByTaskId[taskId] === true || patchedCompletions[taskId] === true,
    [completedByTaskId, patchedCompletions]
  );

  const isTaskSkipped = useCallback(
    (taskId: string) => skippedByTaskId[taskId] === true,
    [skippedByTaskId]
  );

  const getWorkoutSessionId = useCallback(
    (taskId: string) =>
      patches.workoutSessionIds[taskId] ?? sessionIdByTaskId[taskId] ?? null,
    [patches.workoutSessionIds, sessionIdByTaskId]
  );

  const allWorkoutsComplete = areMainWorkoutsComplete(
    workoutsForDay,
    isTaskCompleted
  );
  const extrasIncomplete = hasIncompleteWorkoutExtras(
    workoutsForDay,
    isTaskCompleted,
    isTaskSkipped
  );
  const completedWorkoutCount = workoutsForDay.filter((workout) =>
    isTaskCompleted(workout.taskId)
  ).length;
  const displayWorkout =
    workoutsForDay.find((workout) => !isTaskCompleted(workout.taskId)) ??
    workoutsForDay[0] ??
    null;
  const focusWorkout =
    workoutsForDay.find(
      (workout) =>
        isMainWorkoutKind(workout.planKind) && !isTaskCompleted(workout.taskId)
    ) ??
    workoutsForDay.find((workout) => isMainWorkoutKind(workout.planKind)) ??
    displayWorkout;
  const removableWorkoutCount = workoutsForDay.filter(
    (workout) => workout.scheduledWorkoutId
  ).length;
  const hasScheduledWorkout = removableWorkoutCount > 0;
  const showCompletedState =
    workoutsForDay.length > 0 && allWorkoutsComplete;
  const resultsReady = variant !== "detail" && showCompletedState;
  const patchedSessionId =
    patches.workoutSessionIds[dateKey] ??
    workoutsForDay
      .map((workout) => patches.workoutSessionIds[workout.taskId])
      .find((id): id is string => Boolean(id)) ??
    null;

  const openEditWorkout = useCallback(() => setEditWorkoutOpen(true), []);

  const canEditDayWorkouts = !readOnly || !hasScheduledWorkout;
  const workoutChromeActions = useMemo(() => {
    if (variant !== "detail") return null;
    const showStart =
      !readOnly && workoutsForDay.length > 0 && !showCompletedState;
    if (!showStart && !canEditDayWorkouts) return null;
    return {
      date: selectedDate,
      disabled: !isDayLoaded,
      showStart,
      ...(canEditDayWorkouts
        ? { showEdit: true as const, onEdit: openEditWorkout }
        : {}),
    };
  }, [
    variant,
    canEditDayWorkouts,
    readOnly,
    workoutsForDay.length,
    showCompletedState,
    selectedDate,
    isDayLoaded,
    openEditWorkout,
  ]);
  useRegisterWorkoutPageChrome(workoutChromeActions);

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
    const timezoneOffsetMinutes = new Date().getTimezoneOffset();

    async function attempt(retryIndex: number) {
      if (cancelled) return;
      const results = await loadWorkoutResults(
        clientId,
        dateKey,
        patches.workoutSessionIds[dateKey],
        timezoneOffsetMinutes
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
    dayRelation(dateKey) === "past";

  if (variant === "hero") {
    const mainWorkout =
      workoutsForDay.find(
        (session) =>
          isMainWorkoutKind(session.planKind) && !isTaskCompleted(session.taskId)
      ) ??
      workoutsForDay.find((session) => isMainWorkoutKind(session.planKind)) ??
      focusWorkout;
    const workout = mainWorkout;
    const totalSets =
      workout?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0;
    const exerciseCount = workout?.exercises.length ?? 0;
    const dayLabel = formatLocalized(selectedDate, "EEEE", locale);
    const durationSeconds = workout
      ? estimateWorkoutDurationSeconds(
          workout.exercises.map((exercise) => ({
            target_sets: exercise.sets,
          }))
        )
      : 0;
    const durationLabel =
      durationSeconds > 0 ? formatWorkoutDurationShort(durationSeconds) : null;
    const kcalLabel =
      durationSeconds > 0
        ? platform.workout.kcalEstimate(
            estimateWorkoutCaloriesKcal(durationSeconds, exerciseCount)
          )
        : null;
    const hasWorkout = workoutsForDay.length > 0;
    const mainDone = mainWorkout
      ? isTaskCompleted(mainWorkout.taskId)
      : showCompletedState;
    const backgroundSrc =
      hasWorkout && workout
        ? resolveDashboardWorkoutBackground(workout, gender)
        : getDashboardRestDayBackgroundSrc(gender);
    const onPhoto = Boolean(backgroundSrc);
    const metaText = onPhoto ? "text-white/90" : "text-foreground/90";
    const softText = onPhoto ? "text-white/65" : "text-muted-foreground";
    const footerBar = onPhoto
      ? "bg-black/25 backdrop-blur-sm"
      : "bg-secondary/40";
    const isRestDayPhoto = onPhoto && !hasWorkout;

    return (
      <>
        <DashboardThemedShell
          id="dashboard-workout"
          theme="workout"
          backgroundSrc={backgroundSrc}
          backgroundAlt={
            hasWorkout && workout
              ? workout.dayTitle || workout.planTitle
              : coachLabels.restDayTitle
          }
          backgroundObjectClass={
            isRestDayPhoto
              ? "object-[55%_30%] scale-[1.08] origin-[55%_30%]"
              : undefined
          }
          backgroundPriority
          className={cn(
            "min-h-[18rem]",
            hasWorkout &&
              "cursor-pointer transition-opacity hover:opacity-95 active:opacity-90"
          )}
        >
          {hasWorkout ? (
            <DashboardCardNavLink
              href={DASHBOARD_DAY_WORKOUT_PATH}
              ariaLabel={platform.trainTabs.workout}
            />
          ) : null}
          <DashboardCardNavBody className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-xs font-black uppercase tracking-[0.14em]",
                    onPhoto
                      ? "border-white/35 bg-black/25 text-white"
                      : "border-primary/45 bg-primary/15 text-primary"
                  )}
                >
                  {dayLabel}
                </span>
                {workout && exerciseCount > 0 ? (
                  <div className={dashboardInteractive}>
                    <WorkoutDifficultyInsightButton
                      exercises={workout.exercises}
                      size="compact"
                    />
                  </div>
                ) : null}
              </div>
              <div
                className={cn(
                  "flex shrink-0 items-center gap-1",
                  dashboardInteractive
                )}
              >
                {!readOnly || !hasScheduledWorkout ? (
                  <DashboardWorkoutPlusMenu
                    light={onPhoto}
                    onEdit={() => setEditWorkoutOpen(true)}
                  />
                ) : null}
                {hasWorkout ? (
                  <DashboardStatusIcon
                    status={dashboardCompletionStatus(
                      showCompletedState,
                      isDayEnded(dateKey)
                    )}
                    aria-label={
                      showCompletedState
                        ? platform.aria.completed
                        : platform.common.incomplete
                    }
                  />
                ) : null}
              </div>
            </div>

            {isUpdatingDay || (!isDayLoaded && isRevalidating) ? (
              <WorkoutHeroBodySkeleton onPhoto={onPhoto} />
            ) : hasWorkout && workout ? (
              <>
                {exerciseCount > 0 ? (
                  <div className="flex min-w-0 flex-col justify-center gap-3 py-1">
                    {durationLabel ? (
                      <p
                        className={cn(
                          "flex items-center gap-2.5 text-sm font-semibold sm:text-base",
                          metaText
                        )}
                      >
                        <Clock
                          className={cn(
                            "h-5 w-5 shrink-0",
                            onPhoto ? "text-sky-300" : "text-sky-600 dark:text-sky-300"
                          )}
                          aria-hidden
                        />
                        <span className="tabular-nums">{durationLabel}</span>
                        <span
                          className={cn(
                            "text-xs font-medium sm:text-sm",
                            softText
                          )}
                        >
                          {platform.workout.estimatedTimeCompact}
                        </span>
                      </p>
                    ) : null}
                    <p
                      className={cn(
                        "flex items-center gap-2.5 text-sm font-semibold sm:text-base",
                        metaText
                      )}
                    >
                      <List
                        className={cn(
                          "h-5 w-5 shrink-0",
                          onPhoto ? "text-red-300" : "text-primary"
                        )}
                        aria-hidden
                      />
                      <span>{platform.common.exercises(exerciseCount)}</span>
                    </p>
                    <p
                      className={cn(
                        "flex items-center gap-2.5 text-sm font-semibold sm:text-base",
                        metaText
                      )}
                    >
                      <Layers
                        className={cn(
                          "h-5 w-5 shrink-0",
                          onPhoto ? "text-red-300" : "text-primary"
                        )}
                        aria-hidden
                      />
                      <span>{platform.workout.setsCount(totalSets)}</span>
                    </p>
                    {kcalLabel ? (
                      <p
                        className={cn(
                          "flex items-center gap-2.5 text-sm font-semibold sm:text-base",
                          metaText
                        )}
                      >
                        <Flame
                          className="h-5 w-5 shrink-0 text-orange-400"
                          aria-hidden
                        />
                        <span className="tabular-nums">{kcalLabel}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-auto">
                  {mainDone ? (
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3.5 py-2.5",
                        footerBar
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {workout.dayTitle || workout.planTitle}
                        </p>
                        <p className={cn("mt-0.5 truncate text-[11px]", softText)}>
                          {platform.common.completed}
                          {durationLabel ? ` · ${durationLabel}` : null}
                        </p>
                      </div>
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                        <Check className="h-5 w-5" strokeWidth={2.5} />
                      </span>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3.5 py-2.5",
                        footerBar
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {workout.dayTitle || workout.planTitle}
                        </p>
                        <p className={cn("mt-0.5 truncate text-[11px]", softText)}>
                          {platform.workout.viewDayPlan}
                          {durationLabel ? ` · ${durationLabel}` : null}
                        </p>
                      </div>
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Play className="h-4 w-4" />
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-1 flex-col justify-center py-6">
                  <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
                    {coachLabels.restDayTitle}
                  </h2>
                </div>

                {!hasScheduledWorkout ? (
                  <div className={cn("mt-auto", dashboardInteractive)}>
                    <button
                      type="button"
                      onClick={() => setAddWorkoutOpen(true)}
                      className={buttonVariants({
                        variant: "ghost",
                        className: cn(
                          DASHBOARD_NAV_GLASS_CLASS,
                          "h-12 w-full rounded-full text-sm font-black uppercase text-foreground shadow-none"
                        ),
                      })}
                    >
                      <Dumbbell className="h-4 w-4" />
                      {platform.workout.addWorkout}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </DashboardCardNavBody>
        </DashboardThemedShell>
        <EditDayWorkoutsDialog
          open={editWorkoutOpen}
          onClose={() => setEditWorkoutOpen(false)}
          dateKey={dateKey}
          workouts={workoutsForDay}
          refreshing={isUpdatingDay}
          onChanged={handleWorkoutAdded}
          onRemoved={handleWorkoutsRemoved}
          onRemoveSettled={handleRemoveSettled}
        />
        <AddWorkoutToDayDialog
          open={addWorkoutOpen}
          onClose={() => setAddWorkoutOpen(false)}
          dateKey={dateKey}
          onAdded={handleWorkoutAdded}
        />
      </>
    );
  }

  if (variant === "compact") {
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
          {!readOnly || !hasScheduledWorkout ? (
            <DashboardWorkoutPlusMenu
              className={dashboardInteractive}
              onEdit={() => setEditWorkoutOpen(true)}
            />
          ) : null}
          <ChevronRight
            className="pointer-events-none h-4 w-4 text-muted-foreground"
            aria-hidden
          />
          {workoutsForDay.length > 0 ? (
            <DashboardStatusIcon
              status={dashboardCompletionStatus(
                showCompletedState,
                isDayEnded(dateKey)
              )}
              aria-label={
                showCompletedState
                  ? platform.aria.completed
                  : platform.common.incomplete
              }
            />
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
          {isUpdatingDay || (!isDayLoaded && isRevalidating) ? (
            <WorkoutListBodySkeleton />
          ) : workoutsForDay.length > 0 ? (
            <ul className={cn("mt-1 flex flex-col gap-2", dashboardInteractive)}>
              {workoutsForDay.map((workout) => (
                <DashboardWorkoutMiniRow
                  key={workout.taskId}
                  workout={workout}
                  done={isTaskCompleted(workout.taskId)}
                  isDayLoaded={isDayLoaded}
                  selectedDate={selectedDate}
                  readOnly={readOnly}
                />
              ))}
            </ul>
          ) : isDayLoaded ? (
            <p className="text-sm text-muted-foreground">{coachLabels.noWorkoutToday}</p>
          ) : null}

          {extrasIncomplete && !isUpdatingDay ? (
            <div
              className={cn(
                "flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200",
                dashboardInteractive
              )}
            >
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{platform.workout.extrasIncompleteWarning}</p>
            </div>
          ) : null}
        </DashboardCardNavBody>
      </Card>
      <EditDayWorkoutsDialog
        open={editWorkoutOpen}
        onClose={() => setEditWorkoutOpen(false)}
        dateKey={dateKey}
        workouts={workoutsForDay}
        refreshing={isUpdatingDay}
        onChanged={handleWorkoutAdded}
        onRemoved={handleWorkoutsRemoved}
        onRemoveSettled={handleRemoveSettled}
      />
      <AddWorkoutToDayDialog
        open={addWorkoutOpen}
        onClose={() => setAddWorkoutOpen(false)}
        dateKey={dateKey}
        onAdded={handleWorkoutAdded}
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
              {extrasIncomplete ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-300">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {platform.workout.extrasIncompleteWarning}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Mobile: edit lives in top chrome left of Start; keep here for lg+. */}
              {canEditDayWorkouts ? (
                <div className="hidden lg:block">
                  <DashboardWorkoutPlusMenu nav onEdit={openEditWorkout} />
                </div>
              ) : null}
              {/* Desktop: Start lives in the top nav on mobile; keep it here for lg+. */}
              {!readOnly &&
              workoutsForDay.length > 0 &&
              !showCompletedState ? (
                <div className="hidden lg:block">
                  <StartTodaysWorkoutButton
                    date={selectedDate}
                    dayFlow
                    disabled={!isDayLoaded}
                    display="nav"
                  />
                </div>
              ) : null}
            </div>
          </div>

          {isUpdatingDay || (!isDayLoaded && isRevalidating) ? (
            <div className="mt-4">
              <DashboardWorkoutDetailSkeleton />
            </div>
          ) : workoutsForDay.length > 0 ? (
            <div className="mt-4 space-y-2.5">
              {workoutsForDay.map((workout) => {
                const workoutKey = workoutNavKey(workout);
                return (
                  <DashboardWorkoutDetailSection
                    key={workout.taskId}
                    workout={workout}
                    workoutKey={workoutKey}
                    highlighted={selectedWorkoutKey === workoutKey}
                    done={isTaskCompleted(workout.taskId)}
                    skipped={isTaskSkipped(workout.taskId)}
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
            <div className="mt-4 space-y-4">
              <DashboardEmptyState>{coachLabels.noWorkoutToday}</DashboardEmptyState>
              {!hasScheduledWorkout ? (
                <button
                  type="button"
                  onClick={() => setAddWorkoutOpen(true)}
                  className={buttonVariants({
                    className:
                      "h-12 w-full rounded-full text-sm font-black uppercase",
                  })}
                >
                  <Dumbbell className="h-4 w-4" />
                  {platform.workout.addWorkout}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mt-4">
              <DashboardWorkoutDetailSkeleton />
            </div>
          )}
        </div>
        <EditDayWorkoutsDialog
          open={editWorkoutOpen}
          onClose={() => setEditWorkoutOpen(false)}
          dateKey={dateKey}
          workouts={workoutsForDay}
          refreshing={isUpdatingDay}
          onChanged={handleWorkoutAdded}
          onRemoved={handleWorkoutsRemoved}
          onRemoveSettled={handleRemoveSettled}
        />
        <AddWorkoutToDayDialog
          open={addWorkoutOpen}
          onClose={() => setAddWorkoutOpen(false)}
          dateKey={dateKey}
          onAdded={handleWorkoutAdded}
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
                detail: workout.planTitle,
              }))}
          />
        </CardTitle>
        {displayWorkout ? (
          <DashboardStatusIcon
            status={dashboardCompletionStatus(
              showCompletedState,
              isDayEnded(dateKey)
            )}
            aria-label={
              showCompletedState
                ? platform.aria.completed
                : platform.common.incomplete
            }
          />
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {isUpdatingDay ? (
          <WorkoutListBodySkeleton />
        ) : workoutsForDay.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {workoutsForDay.map((workout) => (
              <DashboardWorkoutMiniRow
                key={workout.taskId}
                workout={workout}
                done={isTaskCompleted(workout.taskId)}
                isDayLoaded={isDayLoaded}
                selectedDate={selectedDate}
                readOnly={readOnly}
              />
            ))}
          </ul>
        ) : isDayLoaded ? (
          <DashboardEmptyState>{coachLabels.noWorkoutToday}</DashboardEmptyState>
        ) : null}
      </CardContent>
    </Card>
  );
}
