"use client";

import {
  useCoachCopy,
  useCoachLabels,
  usePlatformCopy,
  useBodyUnits,
} from "@/components/locale-provider";
import { formatExerciseHistoryLabel } from "@/lib/exercise-history-format";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
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
import {
  estimateWorkoutDurationSeconds,
  formatElapsedClock,
  formatWorkoutDurationShort,
} from "@/lib/workout-duration";
import { markReminderDone } from "@/lib/reminder-events";
import { clearWorkoutTimerState } from "@/lib/workout-timer-storage";
import { formatUserError } from "@/lib/format-user-error";
import {
  SessionBusyOverlay,
  SessionCircleButton,
  SessionMediaStage,
  SessionSideIconButton,
  SessionStat,
  SessionStatRow,
  SessionTopBar,
  formatSessionClock,
} from "@/components/workout-session-ui";
import { AppDialog } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function useElapsedSeconds(
  baseSeconds: number,
  runningSinceMs: number | null
) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (runningSinceMs == null) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningSinceMs]);

  const live =
    runningSinceMs == null
      ? 0
      : Math.max(0, Math.floor((now - runningSinceMs) / 1000));
  return baseSeconds + live;
}

function useWorkoutTimer(isStarted: boolean) {
  const [baseSeconds, setBaseSeconds] = useState(0);
  const [runningSinceMs, setRunningSinceMs] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!isStarted) {
      setBaseSeconds(0);
      setRunningSinceMs(null);
      setPaused(false);
      return;
    }
    setBaseSeconds(0);
    setPaused(false);
    setRunningSinceMs(Date.now());
  }, [isStarted]);

  const resetTimer = () => {
    setBaseSeconds(0);
    setPaused(false);
    setRunningSinceMs(Date.now());
  };

  const togglePause = () => {
    if (paused) {
      setRunningSinceMs(Date.now());
      setPaused(false);
      return;
    }
    setRunningSinceMs((since) => {
      if (since != null) {
        setBaseSeconds(
          (base) => base + Math.max(0, Math.floor((Date.now() - since) / 1000))
        );
      }
      return null;
    });
    setPaused(true);
  };

  return { baseSeconds, runningSinceMs, paused, resetTimer, togglePause };
}

function useRestCountdown(restSeconds: number | null, workoutPaused: boolean) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || workoutPaused || remaining == null) return;
    if (remaining <= 0) {
      setRunning(false);
      return;
    }
    const id = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev == null || prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, remaining, workoutPaused]);

  const start = (seconds?: number | null) => {
    const secs = Math.max(0, Math.floor(seconds ?? restSeconds ?? 90));
    setRemaining(secs);
    setRunning(secs > 0);
  };

  const reset = () => {
    setRunning(false);
    setRemaining(restSeconds != null ? Math.max(0, restSeconds) : null);
  };

  return {
    remaining,
    running: running && !workoutPaused,
    displaySeconds: remaining ?? restSeconds ?? 90,
    start,
    reset,
  };
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
    units.unitSystem,
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
    if (result.error) onSaveError?.(result.error);
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
    const reps = parseRepsField(repsDraft);
    const weight_kg = parseWeightField(weightDraft);
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
    <div className="flex flex-col gap-4">
      <SessionMediaStage
        sideActions={
          <>
            <SessionSideIconButton
              label={platform.workout.preview}
              onClick={() => setShowHowTo(true)}
            >
              <Info className="h-4 w-4" />
            </SessionSideIconButton>
          </>
        }
      >
        <div className="relative z-0 w-full overflow-hidden bg-secondary/40 [&_>div]:max-w-none [&_>div]:rounded-none [&_>div]:border-0">
          <ExerciseDemoPlayer
            name={exercise.name}
            imageUrl={exercise.image_url}
            videoUrl={exercise.video_url}
            gender={gender}
            autoplay
            paused={mediaPaused}
          />
        </div>
      </SessionMediaStage>

      <div className="space-y-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {platform.workout.exerciseProgress(exerciseIndex + 1, exerciseTotal)}
        </p>
        <h2 className="text-xl font-black leading-tight tracking-tight sm:text-2xl">
          {exercise.name}
        </h2>
      </div>

      {previousSets.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary">
            {platform.workout.previous}
          </p>
          <div className="flex w-full gap-1.5">
            {previousSets.map((set, index) => (
              <button
                key={`prev-${index}`}
                type="button"
                disabled={readOnly}
                onClick={() => {
                  if (set.reps != null) setRepsDraft(String(set.reps));
                  if (set.weight_kg != null) {
                    setWeightDraft(units.formatWeightKg(Number(set.weight_kg)));
                  }
                }}
                className="inline-flex min-w-0 flex-1 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-2 py-2 text-center text-[11px] font-medium tabular-nums text-primary transition hover:bg-primary/15 disabled:opacity-60"
              >
                {index + 1}. {set.reps != null ? set.reps : "—"}
                {set.weight_kg != null
                  ? ` × ${units.formatWeightKg(Number(set.weight_kg))}`
                  : ""}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-xs font-medium text-primary">
          {historyLabel}
        </p>
      )}

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

      <SessionStatRow>
        <SessionStat
          value={exercise.target_reps || "—"}
          label={platform.workout.repsRequired}
        />
        <SessionStat
          value={restClock}
          label={platform.workout.rest}
          emphasize
          pulse={restRunning}
        />
        <SessionStat
          value={`${completedSets}/${targetSets}`}
          label={platform.workout.setsDone}
        />
      </SessionStatRow>

      {!readOnly ? (
        <div className="space-y-3">
          <div className="flex items-stretch gap-2">
            <Input
              type="number"
              inputMode="numeric"
              placeholder={repsPlaceholder}
              value={repsDraft}
              onChange={(e) => setRepsDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleLogSet();
              }}
              className="h-12 flex-1 rounded-xl border-border/60 bg-secondary/40 text-base"
            />
            <Input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={weightPlaceholder}
              value={weightDraft}
              onChange={(e) => setWeightDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleLogSet();
              }}
              className="h-12 w-[30%] min-w-[5.5rem] rounded-xl border-border/60 bg-secondary/40 text-base"
            />
            <Button
              type="button"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-xl"
              disabled={isAddingSet || (repsDraft === "" && weightDraft === "")}
              onClick={() => void handleLogSet()}
              aria-label={platform.workout.logSet}
            >
              {isAddingSet ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5" strokeWidth={2.5} />
              )}
            </Button>
          </div>

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
              <div className="flex w-full gap-1.5">
                {setSlots.map((set, index) => {
                  const setNumber = index + 1;
                  const done = isSetDone(set);
                  const isCurrent =
                    !done &&
                    (activeSet
                      ? activeSet.set_number === setNumber
                      : completedSets === index);

                  return (
                    <span
                      key={set?.id ?? `slot-${setNumber}`}
                      className={cn(
                        "inline-flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-2 text-center tabular-nums",
                        done &&
                          "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
                        isCurrent &&
                          "border-primary/45 bg-primary/10 text-foreground",
                        !done &&
                          !isCurrent &&
                          "border-border/50 bg-secondary/40 text-muted-foreground"
                      )}
                      aria-label={
                        done
                          ? `Set ${setNumber} completed`
                          : isCurrent
                            ? `Set ${setNumber} current`
                            : `Set ${setNumber}`
                      }
                    >
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide">
                        {done ? (
                          <Check
                            className="h-3 w-3 shrink-0 text-emerald-500"
                            strokeWidth={3}
                            aria-hidden
                          />
                        ) : null}
                        {setNumber}
                      </span>
                      <span className="max-w-full truncate text-[11px] font-medium leading-tight">
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
                    </span>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
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
  const coachLabels = useCoachLabels();
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
    baseSeconds,
    runningSinceMs,
    paused: workoutPaused,
    resetTimer,
    togglePause,
  } = useWorkoutTimer(isStarted);
  const elapsedSeconds = useElapsedSeconds(baseSeconds, runningSinceMs);
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

  const estimatedSeconds = useMemo(
    () => estimateWorkoutDurationSeconds(exercises),
    [exercises]
  );

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

  const handleDiscardWorkout = () => {
    void leaveWorkout();
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

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-4 pb-[max(1rem,var(--safe-area-bottom))] pt-2">
      <SessionTopBar
        title={headerTitle}
        subtitle={
          isStarted
            ? `${formatElapsedClock(elapsedSeconds)} · ${platform.workout.estTotal(formatWorkoutDurationShort(estimatedSeconds))}`
            : session.plan_title && session.plan_title !== headerTitle
              ? session.plan_title
              : null
        }
        onBack={() => void leaveWorkout({ confirm: false })}
        backDisabled={isPending || isGivingUp}
        trailing={
          !isStarted ? (
            <StartWorkoutLoadingShell isLoading={isPending}>
              <SessionCircleButton
                label={platform.workout.startWorkout}
                onClick={handleBeginWorkout}
                disabled={isPending || isLoadingExercises}
                busy={isPending}
              />
            </StartWorkoutLoadingShell>
          ) : (
            <SessionCircleButton
              label={workoutPaused ? platform.cardio.resume : platform.cardio.pause}
              onClick={togglePause}
              className={
                workoutPaused
                  ? undefined
                  : "bg-emerald-500 text-white shadow-[0_0_0_3px_rgba(16,185,129,0.22)]"
              }
            >
              {workoutPaused ? (
                <Play className="h-5 w-5 fill-current" />
              ) : (
                <Pause className="h-5 w-5 fill-current" />
              )}
            </SessionCircleButton>
          )
        }
      />

      <DayFlowProgress
        currentKind={planKind}
        compact
        className="justify-center px-0"
      />

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4">
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
              }
            }}
            mediaPaused={workoutPaused}
          />
        ) : null}

        {exercises.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-w-0 flex-1 rounded-full"
              disabled={activeIndex <= 0}
              onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4 shrink-0" />
              {platform.workout.previousExercise}
            </Button>
            {isStarted ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 rounded-full px-2 text-muted-foreground"
                onClick={() => setShowAddExercise(true)}
              >
                <Plus className="mr-1 h-4 w-4" />
                {platform.workout.addExercise}
              </Button>
            ) : (
              <div className="min-w-[1rem] shrink-0" />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-w-0 flex-1 rounded-full"
              disabled={activeIndex >= exercises.length - 1}
              onClick={() =>
                setActiveIndex((i) => Math.min(exercises.length - 1, i + 1))
              }
            >
              {platform.workout.nextExercise}
              <ChevronRight className="ml-1 h-4 w-4 shrink-0" />
            </Button>
          </div>
        ) : null}
      </div>

      {isStarted && showAddExercise ? (
          <div className="space-y-3 rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="space-y-1">
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
                onClick={handleAddExercise}
                disabled={isPending || !newExerciseName.trim()}
              >
                {platform.common.add}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddExercise(false);
                  setNewExerciseName("");
                }}
              >
                {platform.common.cancel}
              </Button>
            </div>
          </div>
        ) : null}

      {isStarted ? (
        <div className="space-y-2 border-t border-border/50 pt-4">
          <Button
            size="lg"
            className="h-12 w-full rounded-full text-base font-bold"
            disabled={isPending || isFinishing || isContinuing}
            onClick={handleFinishWorkout}
          >
            {isFinishing || isContinuing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                {coachLabels.actuallyFinish}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            disabled={isPending || isFinishing || isGivingUp}
            onClick={handleDiscardWorkout}
          >
            {platform.workout.discardWorkout}
          </Button>
        </div>
      ) : null}

      {isFinishing || isContinuing ? (
        <SessionBusyOverlay label={platform.common.saving} />
      ) : null}
      {giveUpDialog}
      {StretchOfferDialog}
    </div>
  );
}
