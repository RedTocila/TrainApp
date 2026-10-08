"use client";

import {
  useCoachCopy,
  usePlatformCopy,
  useBodyUnits,
} from "@/components/locale-provider";
import { formatExerciseHistoryLabel } from "@/lib/exercise-history-format";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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
  getExerciseHistories,
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
import { resolveProfileGender, type ExerciseGender } from "@/lib/exercise-gif";
import { findCatalogExercise } from "@/lib/exercise-catalog";
import { StartWorkoutLoadingShell } from "@/components/start-workout-loading-shell";
import { useDashboardSync } from "@/components/dashboard-sync";
import { DayFlowProgress } from "@/components/day-flow-progress";
import { useDayWorkoutFlowContinue } from "@/components/day-workout-flow";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { cn, formatDateKey } from "@/lib/utils";
import { formatElapsedClock } from "@/lib/workout-duration";
import { markReminderDone } from "@/lib/reminder-events";
import {
  clearWorkoutTimerState,
  getWorkoutElapsedMs,
  getWorkoutTimerState,
  pauseWorkoutTimer,
  resumeWorkoutTimer,
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

function useWorkoutTimer(sessionId: string, isStarted: boolean) {
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
    setTimer(startWorkoutTimer(sessionId));
    setNow(Date.now());
  }, [isStarted, sessionId]);

  useEffect(() => {
    if (!timer || timer.status !== "running") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
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
  onLoggedSet: () => void;
  onAllSetsDone?: () => void;
  mediaPaused?: boolean;
  onBackExercise?: () => void;
  canGoBack?: boolean;
}) {
  const platform = usePlatformCopy();
  const units = useBodyUnits();
  const [isAddingSet, setIsAddingSet] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [repsDraft, setRepsDraft] = useState("");
  const [weightDraft, setWeightDraft] = useState("");
  const historyLabel = formatExerciseHistoryLabel(
    history,
    platform.workout.lastSets,
    platform.workout.neverTried
  );
  const previousSets = (history?.sets ?? []).filter(
    (s) => s.reps != null || s.weight_kg != null
  );
  const sets = exercise.sets ?? [];
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
  const repsPlaceholder =
    previousForNextSet?.reps != null
      ? String(previousForNextSet.reps)
      : platform.workout.reps;
  const weightPlaceholder =
    previousForNextSet?.weight_kg != null
      ? units.formatWeightKg(Number(previousForNextSet.weight_kg))
      : units.weightFieldLabel;
  const currentSetNumber = Math.min(completedSets + 1, targetSets);
  const repsDisplay =
    repsDraft !== ""
      ? repsDraft
      : activeSet?.reps != null
        ? String(activeSet.reps)
        : repsPlaceholder;
  const weightDisplay =
    weightDraft !== ""
      ? weightDraft
      : activeSet?.weight_kg != null
        ? units.formatWeightKg(Number(activeSet.weight_kg))
        : weightPlaceholder;

  const adjustReps = (delta: number) => {
    const parsed = parseRepsField(repsDraft);
    const base =
      parsed ??
      activeSet?.reps ??
      previousForNextSet?.reps ??
      (typeof exercise.target_reps === "number"
        ? exercise.target_reps
        : parseInt(String(exercise.target_reps || 10), 10)) ??
      10;
    setRepsDraft(String(Math.max(0, base + delta)));
  };

  const adjustWeight = (deltaKg: number) => {
    const parsed = parseWeightField(weightDraft);
    const baseKg =
      parsed ??
      activeSet?.weight_kg ??
      previousForNextSet?.weight_kg ??
      0;
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

  const parseRepsField = (rawValue: string) =>
    rawValue === "" ? null : parseInt(rawValue, 10);

  const parseWeightField = (rawValue: string) =>
    rawValue === "" ? null : units.parseWeightInput(rawValue);

  const persistSet = async (
    setId: string,
    reps: number | null,
    weight_kg: number | null,
    setsSnapshot: WorkoutSessionSet[]
  ) => {
    const completed = reps != null || weight_kg != null;
    const nextSets = setsSnapshot.map((set) =>
      set.id === setId ? { ...set, reps, weight_kg, completed } : set
    );
    onSetsChange(nextSets);
    const result = await updateSessionSet(setId, { reps, weight_kg, completed });
    if (result.error) {
      onSetsChange(setsSnapshot);
      onSaveError?.(result.error);
      return;
    }
    if (completed) {
      onLoggedSet();
      const nextCompleted = nextSets.filter(
        (set) => set.completed || set.reps != null || set.weight_kg != null
      ).length;
      if (nextCompleted >= targetSets) {
        onAllSetsDone?.();
      }
    }
  };

  const handleLogSet = async () => {
    if (readOnly || isAddingSet) return;
    let reps = parseRepsField(repsDraft);
    let weight_kg = parseWeightField(weightDraft);
    if (reps == null && previousForNextSet?.reps != null) {
      reps = previousForNextSet.reps;
    }
    if (weight_kg == null && previousForNextSet?.weight_kg != null) {
      weight_kg = Number(previousForNextSet.weight_kg);
    }
    if (
      (repsDraft !== "" && (reps == null || Number.isNaN(reps))) ||
      (weightDraft !== "" && (weight_kg == null || Number.isNaN(weight_kg)))
    ) {
      return;
    }
    if (reps == null && weight_kg == null) return;

    setIsAddingSet(true);
    try {
      if (activeSet) {
        await persistSet(activeSet.id, reps, weight_kg, sets);
      } else {
        const created = await addSessionSet(exercise.id);
        if (created.error) {
          onSaveError?.(created.error);
          return;
        }
        if (created.data) {
          const withNew = [...sets, created.data];
          onSetsChange(withNew);
          await persistSet(created.data.id, reps, weight_kg, withNew);
        }
      }
      setRepsDraft("");
      setWeightDraft("");
    } finally {
      setIsAddingSet(false);
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
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
        className={cn(
          "mx-auto w-full shrink-0 [&>div]:overflow-hidden [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none",
          readOnly
            ? "[&>div]:rounded-[1.75rem]"
            : "[&>div]:rounded-[1.35rem]"
        )}
      >
        <div
          className={cn(
            "workout-demo-stage relative mx-auto w-full overflow-hidden bg-white shadow-[0_18px_48px_-28px_rgba(0,0,0,0.85)] ring-1 ring-white/15",
            readOnly
              ? "aspect-square max-h-[min(62dvh,36rem)]"
              : "h-[min(36vh,280px)] max-w-[20rem]"
          )}
        >
          <div className="absolute inset-0 [&_>div]:h-full [&_>div]:max-w-none [&_>div]:rounded-none [&_>div]:border-0 [&_*]:bg-white">
            <ExerciseDemoPlayer
              name={exercise.name}
              imageUrl={exercise.image_url}
              videoUrl={exercise.video_url}
              gender={gender}
              autoplay
              paused={mediaPaused}
              fill
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
              disabled={isAddingSet}
            />
            <WorkoutMetricCard
              label={platform.workout.reps}
              value={repsDisplay}
              onDecrement={() => adjustReps(-1)}
              onIncrement={() => adjustReps(1)}
              disabled={isAddingSet}
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
              disabled={isAddingSet}
              onClick={() => void handleLogSet()}
            >
              {isAddingSet ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="mr-1.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
                  {platform.workout.finishSet(currentSetNumber)}
                </>
              )}
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
  const isStarted = session.started_at != null;
  const {
    elapsedSeconds,
    paused: workoutPaused,
    resetTimer,
    togglePause,
  } = useWorkoutTimer(session.id, isStarted);
  const exerciseGender = resolveProfileGender(gender);
  const leaveHandledRef = useRef(false);

  const activeExercise = exercises[Math.min(activeIndex, exercises.length - 1)];
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
    void getExerciseHistories(
      initialExercises.map((ex) => ({
        exerciseId: ex.exercise_id,
        name: ex.name,
      }))
    ).then((loaded) => {
      if (!cancelled) setHistories(loaded);
    });

    return () => {
      cancelled = true;
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

  const leaveWorkout = async (options?: { confirm?: boolean }) => {
    if (leaveHandledRef.current) return;
    const run = async () => {
      leaveHandledRef.current = true;
      setError(null);
      const result = await cancelWorkoutSession(session.id);
      if (result.error) {
        leaveHandledRef.current = false;
        setError(result.error);
        return;
      }
      clearWorkoutTimerState(session.id);
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
    setError(null);
    startTransition(async () => {
      const result = await beginWorkoutSession(session.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      leaveHandledRef.current = false;
      clearWorkoutTimerState(session.id);
      resetTimer();
      router.refresh();
    });
  };

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
    leaveHandledRef.current = true;
    try {
      const result = await completeWorkoutSession(session.id, null);
      if (result.error) {
        leaveHandledRef.current = false;
        setError(result.error);
        finishLockRef.current = false;
        setIsFinishing(false);
        return;
      }
      clearWorkoutTimerState(session.id);
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
        finishLockRef.current = false;
        setIsFinishing(false);
      }
    } catch (err) {
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

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2",
          isStarted ? "overflow-y-auto overscroll-contain" : "overflow-hidden"
        )}
      >
        {isLoadingExercises ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {platform.workout.starting}
            </p>
          </div>
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
            onSaveError={setError}
            readOnly={!isStarted}
            gender={exerciseGender}
            restClock={formatSessionClock(rest.displaySeconds)}
            restRunning={rest.running}
            onLoggedSet={() => rest.start(activeExercise.rest_seconds)}
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
