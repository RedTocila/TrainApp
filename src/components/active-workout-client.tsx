"use client";

import {
  useCoachCopy,
  usePlatformCopy,
  useBodyUnits,
} from "@/components/locale-provider";
import { formatExerciseHistoryLabel } from "@/lib/exercise-history-format";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
} from "lucide-react";
import {
  addSessionExercise,
  addSessionSet,
  beginWorkoutSession,
  cancelWorkoutSession,
  completeWorkoutSession,
  ensureWorkoutSessionExercises,
  getLatestExerciseHistoriesByNames,
  updateSessionSet,
} from "@/lib/actions/workout-sessions";
import type {
  ExerciseHistoryEntry,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionSet,
} from "@/lib/types";
import type { WorkoutPlanKind } from "@/lib/hiit";
import { ExerciseDemoPlayer } from "@/components/exercise-demo-player";
import { resolveExerciseGifUrl, resolveProfileGender, type ExerciseGender } from "@/lib/exercise-gif";
import { buildLiveBoard, catchUpLiveSession, endLiveWorkout, subscribeAppForeground, useLiveWorkoutPublisher } from "@/lib/live-workout";
import {
  pushWorkoutMirror,
  subscribeWorkoutMirror,
  suppressWorkoutMirror,
} from "@/lib/watch-session";
import { isPendingWorkoutSessionId } from "@/lib/staged-workout-open";
import {
  WorkoutOpenSkeleton,
  WorkoutReadyBodySkeleton,
} from "@/components/dashboard-page-skeleton";
import { ExerciseGifThumbnail } from "@/components/exercise-gif-thumbnail";
import { WorkoutTypeBanner } from "@/components/workout-type-banner";
import { findCatalogExercise } from "@/lib/exercise-catalog";
import { StartWorkoutLoadingShell } from "@/components/start-workout-loading-shell";
import { useDashboardSync } from "@/components/dashboard-sync";
import { DayFlowProgress } from "@/components/day-flow-progress";
import { useDayWorkoutFlowContinue } from "@/components/day-workout-flow";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { cn, formatDateKey } from "@/lib/utils";
import {
  estimateWorkoutDurationSeconds,
  formatElapsedClock,
  formatWorkoutDurationShort,
} from "@/lib/workout-duration";
import { markReminderDone } from "@/lib/reminder-events";
import {
  clearWorkoutTimerState,
  getWorkoutElapsedMs,
  getWorkoutResumeIndex,
  getWorkoutTimerState,
  pauseWorkoutTimer,
  resumeWorkoutTimer,
  setWorkoutResumeIndex,
  setWorkoutTimerState,
  startWorkoutTimer,
  type WorkoutTimerState,
} from "@/lib/workout-timer-storage";
import { formatUserError } from "@/lib/format-user-error";
import {
  SessionBusyOverlay,
  SessionCircleButton,
  SessionMediaStage,
  SessionTopBar,
  formatSessionClock,
} from "@/components/workout-session-ui";
import { AppDialog } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function preserveLoggedSets(
  local: WorkoutSessionExercise[],
  incoming: WorkoutSessionExercise[]
): WorkoutSessionExercise[] {
  const logged = new Map<string, WorkoutSessionSet>();
  for (const exercise of local) {
    for (const set of exercise.sets ?? []) {
      if (set.completed) logged.set(set.id, set);
    }
  }
  if (logged.size === 0) return incoming;
  return incoming.map((exercise) => ({
    ...exercise,
    sets: exercise.sets?.map((set) => {
      if (set.completed) return set;
      const extra = logged.get(set.id);
      return extra
        ? { ...set, completed: true, reps: extra.reps, weight_kg: extra.weight_kg }
        : set;
    }),
  }));
}

function useWorkoutTimer(
  sessionId: string,
  isStarted: boolean,
  startedAt: string | null
) {
  const [timer, setTimer] = useState<WorkoutTimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isStarted) {
      setTimer(null);
      return;
    }
    const existing = getWorkoutTimerState(sessionId);
    if (
      existing &&
      (existing.status === "running" || existing.status === "paused")
    ) {
      setTimer(existing);
      setNow(Date.now());
      return;
    }
    if (startedAt) {
      const elapsed = Date.now() - new Date(startedAt).getTime();
      if (Number.isFinite(elapsed) && elapsed >= 0) {
        const seeded: WorkoutTimerState = {
          sessionId,
          status: "running",
          accumulatedMs: elapsed,
          segmentStartedAt: Date.now(),
        };
        setWorkoutTimerState(seeded);
        setTimer(seeded);
        setNow(Date.now());
        return;
      }
    }
    setTimer(startWorkoutTimer(sessionId));
    setNow(Date.now());
  }, [isStarted, sessionId, startedAt]);

  useEffect(() => {
    if (!timer || timer.status !== "running") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [timer]);

  const elapsedSeconds = Math.floor(getWorkoutElapsedMs(timer, now) / 1000);
  const paused = timer?.status === "paused";

  const resetTimer = () => {
    clearWorkoutTimerState(sessionId);
    setTimer(startWorkoutTimer(sessionId));
    setNow(Date.now());
  };

  const togglePause = () => {
    if (paused) {
      setTimer(resumeWorkoutTimer(sessionId));
    } else {
      setTimer(pauseWorkoutTimer(sessionId));
    }
    setNow(Date.now());
  };

  return { elapsedSeconds, paused, resetTimer, togglePause };
}

/** Rest countdown via wall-clock deadline (avoids setInterval remaining-1 drift). */
function useRestCountdown(restSeconds: number | null, workoutPaused: boolean) {
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [frozenRemainingMs, setFrozenRemainingMs] = useState<number | null>(
    null
  );
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    if (workoutPaused) {
      if (deadlineMs != null) {
        setFrozenRemainingMs(Math.max(0, deadlineMs - Date.now()));
        setDeadlineMs(null);
      }
      return;
    }
    if (deadlineMs == null && frozenRemainingMs != null) {
      setDeadlineMs(Date.now() + frozenRemainingMs);
      setFrozenRemainingMs(null);
    }
  }, [running, workoutPaused, deadlineMs, frozenRemainingMs]);

  useEffect(() => {
    if (!running || workoutPaused || deadlineMs == null) return;
    const tick = () => {
      const left = deadlineMs - Date.now();
      setNow(Date.now());
      if (left <= 0) {
        setRunning(false);
        setDeadlineMs(null);
        setFrozenRemainingMs(0);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running, workoutPaused, deadlineMs]);

  const remainingMs =
    deadlineMs != null
      ? Math.max(0, deadlineMs - now)
      : frozenRemainingMs;

  const remaining =
    remainingMs == null ? null : Math.ceil(remainingMs / 1000);

  const start = (seconds?: number | null) => {
    const secs = Math.max(0, Math.floor(seconds ?? restSeconds ?? 90));
    if (secs <= 0) {
      setRunning(false);
      setDeadlineMs(null);
      setFrozenRemainingMs(0);
      return;
    }
    setFrozenRemainingMs(null);
    setDeadlineMs(Date.now() + secs * 1000);
    setNow(Date.now());
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setDeadlineMs(null);
    setFrozenRemainingMs(
      restSeconds != null ? Math.max(0, restSeconds) * 1000 : null
    );
  };

  return {
    remaining,
    running: running && !workoutPaused,
    displaySeconds: remaining ?? restSeconds ?? 90,
    start,
    reset,
  };
}

/** Workout loads may be bodyweight. Body-weight parsing rejects 0. */
function parseSetWeightKg(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 500) return null;
  return Math.round(parsed * 100) / 100;
}

function WorkoutMetricCard({
  label,
  value,
  unit,
  onDecrement,
  onIncrement,
  disabled,
}: {
  label: string;
  value: string;
  unit?: string;
  onDecrement: () => void;
  onIncrement: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-border/50 bg-zinc-900/70 px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xl font-black tabular-nums leading-none text-foreground">
        {value}
        {unit ? (
          <span className="ml-1 text-[10px] font-bold uppercase text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </p>
      <div className="mt-2 flex items-center justify-between gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={onDecrement}
          aria-label={`Decrease ${label}`}
          className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-foreground transition hover:bg-secondary disabled:opacity-45"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onIncrement}
          aria-label={`Increase ${label}`}
          className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-foreground transition hover:bg-secondary disabled:opacity-45"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ActiveExercisePanel({
  exercise,
  exerciseIndex,
  exerciseTotal,
  history,
  onSetsChange,
  onSaveError,
  readOnly,
  gender,
  restClock,
  restRunning = false,
  onLoggedSet,
  onAllSetsDone,
  mediaPaused,
  onBackExercise,
  canGoBack,
  onLiveDraft,
  remoteDraft,
}: {
  exercise: WorkoutSessionExercise;
  exerciseIndex: number;
  exerciseTotal: number;
  history: ExerciseHistoryEntry | null;
  onSetsChange: (sets: WorkoutSessionSet[]) => void;
  onSaveError?: (message: string) => void;
  readOnly: boolean;
  gender?: ExerciseGender | null;
  restClock: string;
  restRunning?: boolean;
  onLoggedSet: (info?: { setId: string; reps: number; weightKg: number }) => void;
  onAllSetsDone?: () => void;
  mediaPaused?: boolean;
  onBackExercise?: () => void;
  canGoBack?: boolean;
  onLiveDraft?: (draft: {
    setId: string | null;
    setNumber: number;
    setCount: number;
    reps: number;
    weightKg: number;
  }) => void;
  remoteDraft?: { token: number; reps: number; weightKg: number } | null;
}) {
  const platform = usePlatformCopy();
  const units = useBodyUnits();
  const loggingSetId = useRef<string | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [repsDraft, setRepsDraft] = useState("");
  const [weightDraft, setWeightDraft] = useState("");
  const applyingRemote = useRef(false);
  const remoteToken = useRef<number | null>(null);
  const historyLabel = formatExerciseHistoryLabel(
    history,
    platform.workout.lastSets,
    platform.workout.neverTried
  );
  const previousSets = (history?.sets ?? []).filter(
    (s) => s.reps != null || s.weight_kg != null
  );
  const sets = exercise.sets ?? [];
  const setsRef = useRef(sets);
  setsRef.current = sets;
  const completedSets = sets.filter(
    (set) => set.completed || set.reps != null || set.weight_kg != null
  ).length;
  const targetSets = Math.max(1, exercise.target_sets || sets.length || 1);
  const activeSet =
    sets.find(
      (set) => !set.completed && set.reps == null && set.weight_kg == null
    ) ?? null;
  const catalog = findCatalogExercise(exercise.name);
  const instructionSteps = catalog?.instructions ?? [];
  const coachNotes = exercise.notes?.trim() || null;
  // Match previous set by index for the set you're about to log.
  const previousForNextSet =
    previousSets[completedSets] ?? previousSets[previousSets.length - 1] ?? null;
  const currentSetNumber = Math.min(completedSets + 1, targetSets);
  const startingReps =
    activeSet?.reps ?? previousForNextSet?.reps ?? 6;
  const startingWeightKg =
    activeSet?.weight_kg != null
      ? Number(activeSet.weight_kg)
      : previousForNextSet?.weight_kg != null
        ? Number(previousForNextSet.weight_kg)
        : 10;
  const repsDisplay = repsDraft !== "" ? repsDraft : String(startingReps);
  const weightDisplay =
    weightDraft !== ""
      ? weightDraft
      : units.formatWeightKg(startingWeightKg);

  const adjustReps = (delta: number) => {
    const parsed = parseRepsField(repsDraft);
    const base = parsed ?? startingReps;
    setRepsDraft(String(Math.max(0, base + delta)));
  };

  const adjustWeight = (deltaKg: number) => {
    const parsed = parseWeightField(weightDraft);
    const baseKg = parsed ?? startingWeightKg;
    const next = Math.max(0, Number(baseKg) + deltaKg);
    setWeightDraft(units.formatWeightKg(next));
  };

  useEffect(() => {
    setRepsDraft(activeSet?.reps != null ? String(activeSet.reps) : "");
    setWeightDraft(
      activeSet?.weight_kg != null
        ? units.formatWeightKg(Number(activeSet.weight_kg))
        : ""
    );
  }, [activeSet?.id, activeSet?.reps, activeSet?.weight_kg, units]);

  useEffect(() => {
    if (!remoteDraft || remoteToken.current === remoteDraft.token) return;
    remoteToken.current = remoteDraft.token;
    applyingRemote.current = true;
    setRepsDraft(String(remoteDraft.reps));
    setWeightDraft(units.formatWeightKg(remoteDraft.weightKg));
    const timer = window.setTimeout(() => {
      applyingRemote.current = false;
    }, 60);
    return () => window.clearTimeout(timer);
  }, [remoteDraft, units]);

  const parseRepsField = (rawValue: string) =>
    rawValue === "" ? null : parseInt(rawValue, 10);

  const parseWeightField = (rawValue: string) =>
    rawValue.trim() === "" ? null : parseSetWeightKg(rawValue);

  const applyLoggedSet = (
    setId: string,
    reps: number | null,
    weight_kg: number | null,
    setsSnapshot: WorkoutSessionSet[]
  ) => {
    const nextSets = setsSnapshot.map((set) =>
      set.id === setId ? { ...set, reps, weight_kg, completed: true } : set
    );
    onSetsChange(nextSets);
    setRepsDraft("");
    setWeightDraft("");
    onLoggedSet({
      setId,
      reps: reps ?? 0,
      weightKg: weight_kg ?? 0,
    });
    const nextCompleted = nextSets.filter(
      (set) => set.completed || set.reps != null || set.weight_kg != null
    ).length;
    if (nextCompleted >= targetSets) onAllSetsDone?.();
    return nextSets;
  };

  const saveLoggedSet = (
    setId: string,
    reps: number | null,
    weight_kg: number | null,
    rollback: WorkoutSessionSet[]
  ) => {
    loggingSetId.current = setId;
    void updateSessionSet(setId, { reps, weight_kg, completed: true }).then((result) => {
      if (loggingSetId.current === setId) loggingSetId.current = null;
      if (!result.error) return;
      const previous = rollback.find((set) => set.id === setId);
      onSetsChange(
        setsRef.current.map((set) => (set.id === setId && previous ? previous : set))
      );
      onSaveError?.(result.error);
    });
  };

  const handleLogSet = () => {
    if (readOnly) return;
    let reps = parseRepsField(repsDraft);
    let weight_kg = parseWeightField(weightDraft);
    if (reps == null) reps = startingReps;
    if (weight_kg == null) weight_kg = startingWeightKg;
    if (
      (repsDraft.trim() !== "" && (reps == null || Number.isNaN(reps))) ||
      (weightDraft.trim() !== "" && (weight_kg == null || Number.isNaN(weight_kg)))
    ) {
      return;
    }

    if (activeSet) {
      if (loggingSetId.current === activeSet.id) return;
      const snapshot = sets;
      applyLoggedSet(activeSet.id, reps, weight_kg, snapshot);
      saveLoggedSet(activeSet.id, reps, weight_kg, snapshot);
      return;
    }

    if (loggingSetId.current === "new") return;
    loggingSetId.current = "new";
    const snapshot = sets;
    void addSessionSet(exercise.id).then((created) => {
      if (created.error || !created.data) {
        if (loggingSetId.current === "new") loggingSetId.current = null;
        onSaveError?.(created.error ?? "Couldn't add a set.");
        return;
      }
      const withNew = [...snapshot, created.data];
      applyLoggedSet(created.data.id, reps, weight_kg, withNew);
      saveLoggedSet(created.data.id, reps, weight_kg, snapshot);
    });
  };

  useEffect(() => {
    if (readOnly || !onLiveDraft || applyingRemote.current) return;
    const parsedReps = parseRepsField(repsDraft);
    const parsedWeight = parseWeightField(weightDraft);
    const reps = parsedReps ?? startingReps;
    const weight = parsedWeight ?? startingWeightKg;
    onLiveDraft({
      setId: activeSet?.id ?? null,
      setNumber: currentSetNumber,
      setCount: targetSets,
      reps: Math.min(40, Math.max(1, Number.isFinite(reps) ? reps : 6)),
      weightKg: Math.min(200, Math.max(0, Number.isFinite(weight) ? weight : 10)),
    });
  }, [
    activeSet?.id,
    activeSet?.reps,
    activeSet?.weight_kg,
    currentSetNumber,
    onLiveDraft,
    previousForNextSet?.reps,
    previousForNextSet?.weight_kg,
    readOnly,
    repsDraft,
    startingReps,
    startingWeightKg,
    targetSets,
    weightDraft,
  ]);

  return (
    <div
      className={cn(
        "flex min-h-full min-w-0 flex-1 flex-col",
        readOnly ? "gap-2" : "gap-3"
      )}
    >
      <div className="shrink-0 space-y-0.5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {platform.workout.exerciseOf(exerciseIndex + 1, exerciseTotal)}
        </p>
        <h2 className="line-clamp-2 text-lg font-black uppercase leading-none tracking-tight">
          {exercise.name}
        </h2>
      </div>

      <SessionMediaStage
        fill
        className={cn(
          "w-full min-h-0 flex-1 [&>div]:overflow-hidden [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none",
          readOnly
            ? "[&>div]:rounded-[1.75rem]"
            : "[&>div]:rounded-[1.35rem]"
        )}
      >
        <div className="workout-demo-stage relative h-full min-h-[11rem] w-full flex-1 overflow-hidden bg-white shadow-[0_18px_48px_-28px_rgba(0,0,0,0.85)] ring-1 ring-white/15">
          <div className="absolute inset-0 [&_>div]:h-full [&_>div]:max-w-none [&_>div]:rounded-none [&_>div]:border-0 [&_*]:bg-white">
            <ExerciseDemoPlayer
              name={exercise.name}
              imageUrl={exercise.image_url}
              videoUrl={exercise.video_url}
              gender={gender}
              autoplay
              paused={mediaPaused}
              fill
              deferMedia={readOnly}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowHowTo(true)}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-sm transition hover:bg-black/90"
          >
            <Play className="h-3 w-3 fill-current" aria-hidden />
            {platform.workout.watchForm}
          </button>
        </div>
      </SessionMediaStage>

      <div className="flex shrink-0 items-baseline justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-foreground">
          {platform.workout.setOf(currentSetNumber, targetSets)}
        </p>
        <p className="max-w-[55%] truncate text-right text-[11px] font-semibold text-primary">
          {historyLabel}
        </p>
      </div>

      <AppDialog
        open={showHowTo}
        onClose={() => setShowHowTo(false)}
        title={exercise.name}
        description={platform.workout.howToDo}
      >
        <div className="space-y-4 px-5 pb-6">
          {instructionSteps.length > 0 ? (
            <ol className="list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-foreground">
              {instructionSteps.map((step, index) => (
                <li key={index} className="pl-1">
                  {step}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              {platform.workout.noInstructions}
            </p>
          )}
          {coachNotes ? (
            <div className="rounded-xl border border-border/60 bg-secondary/40 px-3 py-3">
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {platform.workout.coachTip}
              </p>
              <p className="text-sm leading-relaxed text-foreground">
                {coachNotes}
              </p>
            </div>
          ) : null}
        </div>
      </AppDialog>

      {!readOnly ? (
        <div className="flex shrink-0 flex-col gap-3">
          <div className="flex gap-2">
            <WorkoutMetricCard
              label={platform.workout.load}
              value={weightDisplay}
              onDecrement={() => adjustWeight(-2.5)}
              onIncrement={() => adjustWeight(2.5)}
            />
            <WorkoutMetricCard
              label={platform.workout.reps}
              value={repsDisplay}
              onDecrement={() => adjustReps(-1)}
              onIncrement={() => adjustReps(1)}
            />
          </div>

          {restRunning ? (
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-primary animate-pulse">
              {platform.workout.rest} · {restClock}
            </p>
          ) : null}

          <div className="space-y-2">
            <p className="text-center text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {platform.workout.allSets}
            </p>

            {(() => {
              const setSlots = Array.from({ length: targetSets }, (_, i) => {
                const setNumber = i + 1;
                return (
                  sets.find((set) => set.set_number === setNumber) ?? null
                );
              });
              const isSetDone = (set: WorkoutSessionSet | null) =>
                Boolean(
                  set &&
                    (set.completed || set.reps != null || set.weight_kg != null)
                );

              return (
                <div
                  className="flex w-full items-start justify-between gap-2"
                  role="list"
                >
                  {setSlots.map((set, index) => {
                    const setNumber = index + 1;
                    const done = isSetDone(set);
                    const isCurrent =
                      !done &&
                      (activeSet
                        ? activeSet.set_number === setNumber
                        : completedSets === index);
                    const tone = done
                      ? "text-emerald-400"
                      : isCurrent
                        ? "text-white"
                        : "text-zinc-500";

                    return (
                      <div
                        key={set?.id ?? `slot-${setNumber}`}
                        role="listitem"
                        className={cn(
                          "flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center tabular-nums",
                          tone
                        )}
                        aria-label={
                          done
                            ? `Set ${setNumber} completed`
                            : isCurrent
                              ? `Set ${setNumber} current`
                              : `Set ${setNumber}`
                        }
                      >
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.1em]",
                            isCurrent && "text-white"
                          )}
                        >
                          {done ? (
                            <Check
                              className="h-3.5 w-3.5 shrink-0"
                              strokeWidth={3}
                              aria-hidden
                            />
                          ) : null}
                          {platform.workout.set} {setNumber}
                        </span>
                        <span
                          className={cn(
                            "max-w-full truncate text-sm font-black leading-tight tabular-nums",
                            done && "text-emerald-400",
                            isCurrent && "text-white",
                            !done && !isCurrent && "text-zinc-500"
                          )}
                        >
                          {done && set
                            ? [
                                set.reps != null ? String(set.reps) : "—",
                                set.weight_kg != null
                                  ? units.formatWeightKg(Number(set.weight_kg))
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" × ")
                            : isCurrent
                              ? "…"
                              : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="relative z-10 grid w-full grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-w-0 rounded-full text-sm font-semibold"
              disabled={!canGoBack}
              onClick={onBackExercise}
            >
              <ChevronLeft className="mr-1 h-4 w-4 shrink-0" />
              {platform.workout.previousExercise}
            </Button>
            <Button
              type="button"
              className="h-11 min-w-0 rounded-full bg-primary text-sm font-black uppercase tracking-[0.08em] text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
              onClick={handleLogSet}
            >
              <Check className="mr-1.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
              {platform.workout.finishSet(currentSetNumber)}
            </Button>
          </div>
        </div>
      ) : (
        <p className="shrink-0 pt-0.5 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {platform.workout.readyToStart}
        </p>
      )}
    </div>
  );
}

function splitRepsTarget(raw: string): { value: string; note: string | null } {
  const text = raw.trim();
  const match = text.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match?.[1]?.trim() && match[2]?.trim()) {
    return { value: match[1].trim(), note: match[2].trim() };
  }
  return { value: text || "—", note: null };
}

function ReadyStat({
  value,
  label,
  caps = true,
}: {
  value: string;
  label: string;
  caps?: boolean;
}) {
  return (
    <div className="flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-secondary px-1.5">
      <span className="w-full truncate text-center text-[12px] font-bold leading-none tabular-nums">
        {value}
      </span>
      <span
        className={cn(
          "w-full truncate text-center text-[9px] font-semibold leading-none tracking-[0.06em] text-muted-foreground",
          caps && "uppercase"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function ReadyWorkoutDetails({
  exercises,
  histories,
  gender,
}: {
  exercises: WorkoutSessionExercise[];
  histories: Record<string, ExerciseHistoryEntry | null>;
  gender?: string | null;
}) {
  const platform = usePlatformCopy();
  const totalSets = exercises.reduce(
    (sum, exercise) => sum + Math.max(1, exercise.target_sets || 1),
    0
  );
  const duration = formatWorkoutDurationShort(
    estimateWorkoutDurationSeconds(exercises)
  );

  return (
    <div className="flex shrink-0 flex-col gap-2.5">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {exercises.length} {platform.workout.exercisesTile} ·{" "}
        {platform.workout.setsCount(totalSets)} · {platform.workout.estTotal(duration)}
      </p>
      <ul className="flex shrink-0 flex-col gap-2">
        {exercises.map((exercise, index) => {
          const sets = Math.max(1, exercise.target_sets || 1);
          const reps = splitRepsTarget(exercise.target_reps?.trim() || "—");
          const restSeconds = exercise.rest_seconds ?? 90;
          const catalog = findCatalogExercise(exercise.name);
          const detail =
            exercise.notes?.trim() ||
            catalog?.instructions?.[0]?.trim() ||
            null;
          const muscles = (catalog?.primary_muscles ?? [])
            .slice(0, 2)
            .map((muscle) => muscle.replace(/_/g, " "))
            .join(" · ");
          const history =
            histories[exercise.exercise_id ?? exercise.name] ??
            histories[exercise.name] ??
            null;
          const lastLabel = formatExerciseHistoryLabel(
            history,
            platform.workout.lastSets,
            platform.workout.neverTried
          );
          const setsLabel = platform.workout
            .setsCount(sets)
            .replace(/^\d+\s*/, "")
            .trim();

          return (
            <li
              key={exercise.id}
              className="shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-secondary/35"
            >
              <div className="flex items-start gap-3 p-3">
                <ExerciseGifThumbnail
                  name={exercise.name}
                  imageUrl={exercise.image_url}
                  videoUrl={exercise.video_url}
                  gender={gender}
                  size="md"
                  className="size-14 shrink-0"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex h-5 items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-bold leading-5">
                      {exercise.name}
                    </p>
                    <span className="shrink-0 text-[10px] font-bold tabular-nums leading-none text-muted-foreground">
                      {index + 1}/{exercises.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <ReadyStat value={String(sets)} label={setsLabel || platform.workout.set} />
                    <ReadyStat
                      value={reps.value}
                      label={reps.note ?? platform.workout.reps}
                      caps={!reps.note}
                    />
                    <ReadyStat
                      value={formatSessionClock(restSeconds)}
                      label={platform.workout.rest}
                    />
                  </div>
                  {muscles ? (
                    <p className="truncate text-[11px] font-medium capitalize leading-4 text-muted-foreground">
                      {muscles}
                    </p>
                  ) : null}
                  {detail ? (
                    <p className="line-clamp-2 overflow-hidden text-xs leading-4 text-foreground/80">
                      {detail}
                    </p>
                  ) : null}
                  <p className="truncate text-xs font-medium leading-4 text-primary/90">
                    {lastLabel}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ActiveWorkoutClient({
  session,
  exercises: initialExercises,
  histories: initialHistories,
  gender,
  planKind = "strength",
}: {
  session: WorkoutSession;
  exercises: WorkoutSessionExercise[];
  histories?: Record<string, ExerciseHistoryEntry | null>;
  gender?: string | null;
  planKind?: WorkoutPlanKind;
}) {
  const coachCopy = useCoachCopy();
  const platform = usePlatformCopy();
  const router = useRouter();
  const { patchDashboard, notifySync } = useDashboardSync();
  const {
    handleAfterComplete,
    StretchOfferDialog,
    isContinuing,
  } = useDayWorkoutFlowContinue();
  const [newExerciseName, setNewExerciseName] = useState("");
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isFinishing, setIsFinishing] = useState(false);
  const finishLockRef = useRef(false);
  const beginSentRef = useRef(false);
  const [startedLocally, setStartedLocally] = useState(false);
  const [remoteDraft, setRemoteDraft] = useState<{
    token: number;
    reps: number;
    weightKg: number;
  } | null>(null);
  const [exercises, setExercises] = useState(initialExercises);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoadingExercises, setIsLoadingExercises] = useState(
    initialExercises.length === 0 && !!session.plan_id && !!session.day_id
  );
  const [histories, setHistories] = useState<
    Record<string, ExerciseHistoryEntry | null>
  >(initialHistories ?? {});
  const { confirm: confirmGiveUp, dialog: giveUpDialog, isPending: isGivingUp } =
    useSarcasticConfirm();
  const isStarted = startedLocally || session.started_at != null;
  const {
    elapsedSeconds,
    paused: workoutPaused,
    resetTimer,
    togglePause,
  } = useWorkoutTimer(session.id, isStarted, session.started_at);
  const exerciseGender = resolveProfileGender(gender);
  const publishLive = useLiveWorkoutPublisher(isStarted);
  const leaveHandledRef = useRef(false);
  const resumeForRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (exercises.length === 0) return;
    if (resumeForRef.current === session.id) return;
    resumeForRef.current = session.id;
    const saved = getWorkoutResumeIndex(session.id);
    if (saved != null && saved < exercises.length) {
      setActiveIndex(saved);
      return;
    }
    const openIndex = exercises.findIndex((exercise) => {
      const target = Math.max(
        1,
        exercise.target_sets ?? exercise.sets?.length ?? 1
      );
      const done = (exercise.sets ?? []).filter(
        (set) => set.completed || set.reps != null || set.weight_kg != null
      ).length;
      return done < target;
    });
    setActiveIndex(openIndex >= 0 ? openIndex : exercises.length - 1);
  }, [exercises, session.id]);

  useEffect(() => {
    if (resumeForRef.current !== session.id) return;
    if (!isStarted || isPendingWorkoutSessionId(session.id)) return;
    setWorkoutResumeIndex(session.id, activeIndex);
  }, [activeIndex, isStarted, session.id]);

  const activeExercise = exercises[Math.min(activeIndex, exercises.length - 1)];
  const reportLiveDraft = useCallback(
    (draft: {
      setId: string | null;
      setNumber: number;
      setCount: number;
      reps: number;
      weightKg: number;
    }) => {
      if (!activeExercise) return;
      publishLive({
        exerciseName: activeExercise.name,
        exerciseIndex: activeIndex,
        exerciseCount: exercises.length,
        gifUrl: resolveExerciseGifUrl({
          name: activeExercise.name,
          imageUrl: activeExercise.image_url,
          gender: exerciseGender,
        }),
        ...draft,
        board: buildLiveBoard(
          exercises,
          (exercise) =>
            resolveExerciseGifUrl({
              name: exercise.name,
              imageUrl: exercise.image_url,
              gender: exerciseGender,
            }),
          draft
        ),
      });
    },
    [activeExercise, activeIndex, exerciseGender, exercises, publishLive]
  );

  useEffect(() => {
    if (!isStarted || isPendingWorkoutSessionId(session.id)) return;
    let cancelled = false;
    let generation = 0;
    const catchUp = async () => {
      const token = ++generation;
      const caught = await catchUpLiveSession(session.id);
      if (cancelled || token !== generation || !caught) return;
      resumeForRef.current = session.id;
      setExercises((current) => preserveLoggedSets(current, caught.exercises));
      if (caught.exercises.length > 0) {
        setActiveIndex(Math.min(caught.exerciseIndex, caught.exercises.length - 1));
      }
      if (caught.draft) {
        setRemoteDraft({
          token: Date.now(),
          reps: caught.draft.reps,
          weightKg: caught.draft.weightKg,
        });
      }
    };
    void catchUp();
    const stop = subscribeAppForeground(() => {
      if (!cancelled) void catchUp();
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [isStarted, session.id]);
  const rest = useRestCountdown(
    activeExercise?.rest_seconds ?? 90,
    workoutPaused
  );

  useEffect(() => {
    rest.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when exercise changes
  }, [activeExercise?.id, activeExercise?.rest_seconds]);

  useEffect(() => {
    setExercises(initialExercises);
    if (initialExercises.length > 0) {
      setIsLoadingExercises(false);
      setActiveIndex((prev) =>
        Math.min(prev, Math.max(0, initialExercises.length - 1))
      );
    }
  }, [initialExercises]);

  useEffect(() => {
    if (initialExercises.length > 0) return;
    if (!session.plan_id || !session.day_id) return;

    let cancelled = false;
    setIsLoadingExercises(true);

    void ensureWorkoutSessionExercises(session.id).then((result) => {
      if (cancelled) return;
      if ("exercises" in result && result.exercises && result.exercises.length > 0) {
        setExercises(result.exercises);
        setIsLoadingExercises(false);
        return;
      }
      setIsLoadingExercises(false);
      if ("error" in result && result.error) {
        setError(result.error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [initialExercises.length, session.day_id, session.id, session.plan_id]);

  useEffect(() => {
    if (initialHistories && Object.keys(initialHistories).length > 0) {
      setHistories(initialHistories);
      return;
    }
    if (initialExercises.length === 0) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void getLatestExerciseHistoriesByNames(
        initialExercises.map((exercise) => exercise.name)
      ).then((byName) => {
        if (cancelled) return;
        const loaded: Record<string, ExerciseHistoryEntry | null> = {};
        for (const exercise of initialExercises) {
          const history = byName[exercise.name.trim().toLowerCase()] ?? null;
          loaded[exercise.exercise_id ?? exercise.name] = history;
          loaded[exercise.name] = history;
        }
        setHistories(loaded);
      });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [initialExercises, initialHistories]);

  const patchExerciseSets = (exerciseId: string, sets: WorkoutSessionSet[]) => {
    setExercises((prev) =>
      prev.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, sets } : exercise
      )
    );
  };

  const refresh = () => router.refresh();

  const leaveWorkout = async (options?: { confirm?: boolean; remote?: boolean }) => {
    if (leaveHandledRef.current) return;
    const run = async () => {
      leaveHandledRef.current = true;
      setError(null);
      if (!isPendingWorkoutSessionId(session.id)) {
        const result = await cancelWorkoutSession(session.id);
        if (result.error && !options?.remote) {
          leaveHandledRef.current = false;
          setError(result.error);
          return;
        }
      }
      clearWorkoutTimerState(session.id);
      void endLiveWorkout();
      if (!options?.remote) {
        void pushWorkoutMirror({
          status: "idle",
          action: "cancel",
          mode: planKind === "hiit" ? "hiit" : "strength",
          sessionId: session.id,
        });
      }
      router.push("/dashboard");
      router.refresh();
    };

    if (options?.confirm === false) {
      await run();
      return;
    }

    confirmGiveUp({
      title: coachCopy.discardWorkout.title,
      message: coachCopy.discardWorkout.message,
      confirmLabel: coachCopy.discardWorkout.confirm,
      cancelLabel: coachCopy.discardWorkout.cancel,
      onConfirm: run,
    });
  };

  const handleBeginWorkout = () => {
    if (isStarted) return;
    setError(null);
    setStartedLocally(true);
    clearWorkoutTimerState(session.id);
    resetTimer();
    void pushWorkoutMirror({
      status: "live",
      action: "start",
      mode: "strength",
      sessionId: session.id,
      exerciseIndex: activeIndex,
    });
  };

  useEffect(() => {
    if (!isStarted || session.started_at) return;
    if (isPendingWorkoutSessionId(session.id)) return;
    if (beginSentRef.current) return;
    beginSentRef.current = true;
    void beginWorkoutSession(session.id).then((result) => {
      if (!result.error) return;
      beginSentRef.current = false;
      if (result.error === "Workout is no longer in progress") {
        router.replace("/dashboard");
        return;
      }
      setStartedLocally(false);
      setError(result.error);
    });
  }, [isStarted, router, session.id, session.started_at]);

  const leaveRef = useRef(leaveWorkout);
  useEffect(() => {
    leaveRef.current = leaveWorkout;
  });

  useEffect(() => {
    return subscribeWorkoutMirror((event) => {
      if (event.action === "cancel" || event.status === "idle") {
        void leaveRef.current({ confirm: false, remote: true });
        return;
      }
      if (event.status !== "live" || event.mode === "hiit") return;
      suppressWorkoutMirror();
      if (event.action === "start") setStartedLocally(true);
      setActiveIndex((current) => {
        const count = exercises.length;
        if (count === 0) return current;
        return Math.min(Math.max(0, event.exerciseIndex), count - 1);
      });
      if (event.action !== "log") {
        setRemoteDraft({
          token: event.seq || Date.now(),
          reps: event.reps,
          weightKg: event.weightKg,
        });
      }
      if (event.action === "log" && event.setId) {
        setExercises((prev) =>
          prev.map((item) => ({
            ...item,
            sets: item.sets?.map((set) =>
              set.id === event.setId
                ? {
                    ...set,
                    reps: event.reps,
                    weight_kg: event.weightKg,
                    completed: true,
                  }
                : set
            ),
          }))
        );
      }
    });
  }, [exercises.length]);

  const handleAddExercise = () => {
    if (!newExerciseName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addSessionExercise(session.id, newExerciseName);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNewExerciseName("");
      setShowAddExercise(false);
      refresh();
    });
  };

  const handleFinishWorkout = async () => {
    if (finishLockRef.current || isFinishing || isContinuing) return;
    finishLockRef.current = true;
    setError(null);
    setIsFinishing(true);
    const safety = window.setTimeout(() => {
      finishLockRef.current = false;
      setIsFinishing(false);
    }, 12000);
    leaveHandledRef.current = true;
    try {
      const result = await completeWorkoutSession(session.id, null);
      if (result.error) {
        window.clearTimeout(safety);
        leaveHandledRef.current = false;
        if (result.error !== "Workout is no longer in progress") {
          setError(result.error);
        } else {
          router.replace("/dashboard");
        }
        finishLockRef.current = false;
        setIsFinishing(false);
        return;
      }
      clearWorkoutTimerState(session.id);
      void endLiveWorkout();
      void pushWorkoutMirror({
        status: "idle",
        action: "cancel",
        mode: "strength",
        sessionId: session.id,
      });
      const dateKey =
        result.scheduledDate ??
        session.scheduled_date ??
        formatDateKey(new Date());
      markReminderDone("workout");
      notifySync();
      patchDashboard({
        dateKey,
        taskId: result.taskId,
        completed: true,
        workoutSessionId: session.id,
      });
      const flow = handleAfterComplete({
        scheduledDate: dateKey,
        taskId: result.taskId,
        planKind: result.planKind ?? planKind,
        nextWorkout: result.nextWorkout ?? null,
      });
      if (flow === "stretch_offer") {
        window.clearTimeout(safety);
        finishLockRef.current = false;
        setIsFinishing(false);
      }
    } catch (err) {
      window.clearTimeout(safety);
      leaveHandledRef.current = false;
      setError(formatUserError(err));
      finishLockRef.current = false;
      setIsFinishing(false);
    }
  };

  const headerTitle =
    session.day_title?.trim() ||
    session.plan_title?.trim() ||
    platform.workout.fallbackTitle;
  const sessionProgress =
    exercises.length > 0
      ? Math.min(1, (activeIndex + 1) / exercises.length)
      : 0;

  return (
    <div
      data-native-pull-refresh="off"
      className={cn(
        "mx-auto flex max-w-lg flex-col px-2 pb-[max(0.75rem,var(--safe-area-bottom))] pt-[max(0.35rem,var(--safe-area-top))] lg:pt-2",
        isStarted
          ? "h-[100dvh] max-h-[100dvh] gap-3 overflow-hidden"
          : "h-[calc(100dvh-0.75rem)] max-h-[calc(100dvh-0.75rem)] gap-2 overflow-hidden"
      )}
    >
      {isStarted ? (
        <div className="shrink-0 space-y-1.5 px-0">
          <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded-full border border-border/60 bg-secondary/50 px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
              disabled={isPending || isGivingUp || isFinishing}
              onClick={() => void leaveWorkout()}
              aria-label={platform.workout.giveUp}
            >
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              {platform.workout.giveUp}
            </button>
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/60 px-3 py-1 font-mono text-xs font-bold tabular-nums text-foreground">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    workoutPaused ? "bg-amber-400" : "bg-primary animate-pulse"
                  )}
                  aria-hidden
                />
                {formatElapsedClock(elapsedSeconds)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-secondary/50 text-foreground transition hover:bg-secondary"
                onClick={() => setShowAddExercise(true)}
                aria-label={platform.workout.addExercise}
              >
                <Plus className="h-4 w-4" />
              </button>
              <SessionCircleButton
                label={workoutPaused ? platform.cardio.resume : platform.cardio.pause}
                onClick={togglePause}
                className={cn(
                  "!h-9 !w-9",
                  workoutPaused
                    ? undefined
                    : "bg-emerald-500 text-white shadow-[0_0_0_3px_rgba(16,185,129,0.22)]"
                )}
              >
                {workoutPaused ? (
                  <Play className="h-4 w-4 fill-current" />
                ) : (
                  <Pause className="h-4 w-4 fill-current" />
                )}
              </SessionCircleButton>
            </div>
          </header>
          <div
            className="h-0.5 overflow-hidden rounded-full bg-secondary/80"
            role="progressbar"
            aria-valuenow={Math.round(sessionProgress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={headerTitle}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${sessionProgress * 100}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          <SessionTopBar
            title={headerTitle}
            subtitle={
              session.plan_title && session.plan_title !== headerTitle
                ? session.plan_title
                : null
            }
            onBack={() => void leaveWorkout()}
            backDisabled={isPending || isGivingUp}
            trailing={
              <StartWorkoutLoadingShell isLoading={isPending}>
                <SessionCircleButton
                  label={platform.workout.startWorkout}
                  onClick={handleBeginWorkout}
                  disabled={isPending || isLoadingExercises}
                  busy={isPending}
                />
              </StartWorkoutLoadingShell>
            }
          />
          <DayFlowProgress
            currentKind={planKind}
            compact
            className="justify-center px-0"
          />
        </>
      )}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {!isStarted ? (
          <div className="flex shrink-0 flex-col gap-3 pb-3 pt-1">
            {isLoadingExercises ? (
              <WorkoutReadyBodySkeleton />
            ) : (
              <>
                <WorkoutTypeBanner
                  planTitle={session.plan_title ?? headerTitle}
                  dayTitle={session.day_title ?? headerTitle}
                  planKind={planKind}
                  exercises={exercises.map((exercise) => ({ name: exercise.name }))}
                  gender={exerciseGender}
                  alt={headerTitle}
                />
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {platform.workout.readyToStart}
                </p>
                {exercises.length > 0 ? (
                  <ReadyWorkoutDetails
                    exercises={exercises}
                    histories={histories}
                    gender={exerciseGender}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : isLoadingExercises ? (
          <WorkoutOpenSkeleton variant="panel" />
        ) : exercises.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border/60 p-6 text-center">
            <p className="font-medium">{platform.workout.noExercisesTitle}</p>
            <p className="text-sm text-muted-foreground">
              {platform.workout.noExercisesHint}
            </p>
          </div>
        ) : activeExercise ? (
          <ActiveExercisePanel
            exercise={activeExercise}
            exerciseIndex={activeIndex}
            exerciseTotal={exercises.length}
            history={
              histories[activeExercise.exercise_id ?? activeExercise.name] ?? null
            }
            onSetsChange={(sets) => patchExerciseSets(activeExercise.id, sets)}
            onSaveError={(message) => {
              if (leaveHandledRef.current) return;
              if (message === "Workout is no longer in progress") {
                router.replace("/dashboard");
                return;
              }
              setError(message);
            }}
            readOnly={!isStarted || isPendingWorkoutSessionId(session.id)}
            gender={exerciseGender}
            restClock={formatSessionClock(rest.displaySeconds)}
            restRunning={rest.running}
            onLoggedSet={(info) => {
              rest.start(activeExercise.rest_seconds);
              if (!info) return;
              void pushWorkoutMirror({
                status: "live",
                action: "log",
                mode: "strength",
                sessionId: session.id,
                exerciseIndex: activeIndex,
                setId: info.setId,
                reps: info.reps,
                weightKg: info.weightKg,
              });
            }}
            onAllSetsDone={() => {
              if (activeIndex < exercises.length - 1) {
                window.setTimeout(() => {
                  setActiveIndex((i) => Math.min(exercises.length - 1, i + 1));
                }, 350);
              } else {
                void handleFinishWorkout();
              }
            }}
            mediaPaused={workoutPaused}
            canGoBack={activeIndex > 0}
            onBackExercise={() => setActiveIndex((i) => Math.max(0, i - 1))}
            onLiveDraft={isStarted ? reportLiveDraft : undefined}
            remoteDraft={remoteDraft}
          />
        ) : null}

      </div>

      <AppDialog
        open={isStarted && showAddExercise}
        onClose={() => {
          setShowAddExercise(false);
          setNewExerciseName("");
        }}
        title={platform.workout.addExercise}
      >
        <div className="space-y-4 px-5 pb-6">
          <div className="space-y-1.5">
            <Label htmlFor="new-exercise">{platform.workout.exerciseName}</Label>
            <Input
              id="new-exercise"
              placeholder={platform.workout.exercisePlaceholder}
              value={newExerciseName}
              onChange={(e) => setNewExerciseName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddExercise()}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleAddExercise}
              disabled={isPending || !newExerciseName.trim()}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                platform.common.add
              )}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowAddExercise(false);
                setNewExerciseName("");
              }}
            >
              {platform.common.cancel}
            </Button>
          </div>
        </div>
      </AppDialog>

      {isFinishing || isContinuing ? (
        <SessionBusyOverlay label={platform.common.saving} />
      ) : null}
      {giveUpDialog}
      {StretchOfferDialog}
    </div>
  );
}
