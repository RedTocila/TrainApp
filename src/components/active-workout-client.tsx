"use client";
import { useCoachCopy, useCoachLabels, usePlatformCopy, useBodyUnits } from "@/components/locale-provider";
import { formatWeightWithUnitFromKg, type UnitSystem } from "@/lib/body-units";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, Check, Clock, Play, Plus, Square } from "lucide-react";
import {
  addSessionExercise,
  addSessionSet,
  beginWorkoutSession,
  cancelWorkoutSession,
  completeWorkoutSession,
  getExerciseHistories,
  updateSessionSet,
} from "@/lib/actions/workout-sessions";
import type {
  ExerciseHistoryEntry,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionSet,
} from "@/lib/types";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { StartWorkoutLoadingShell } from "@/components/start-workout-loading-shell";
import { useDashboardSync } from "@/components/dashboard-sync";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { formatDateKey } from "@/lib/utils";
import {
  estimateWorkoutDurationSeconds,
  formatElapsedClock,
  formatWorkoutDurationShort,
  getWorkoutSetStats,
} from "@/lib/workout-duration";
import {
  clearWorkoutTimerAnchor,
  getWorkoutTimerAnchor,
  setWorkoutTimerAnchor,
} from "@/lib/workout-timer-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

function formatHistory(
  history: ExerciseHistoryEntry | null | undefined,
  lastLabel: (parts: string) => string,
  unitSystem: UnitSystem
): string | null {
  if (!history?.sets.length) return null;
  const parts = history.sets
    .filter((s) => s.reps != null || s.weight_kg != null)
    .map((s) => {
      const reps = s.reps != null ? `${s.reps}` : "—";
      const weight =
        s.weight_kg != null
          ? formatWeightWithUnitFromKg(Number(s.weight_kg), unitSystem)
          : "—";
      return `${reps} × ${weight}`;
    });
  if (parts.length === 0) return null;
  return lastLabel(parts.join(", "));
}

function useElapsedSeconds(anchorMs: number | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (anchorMs == null) return 0;

  return Math.max(0, Math.floor((now - anchorMs) / 1000));
}

function useWorkoutTimerAnchor(sessionId: string, dbStartedAt: string | null) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [anchorMs, setAnchorMs] = useState<number | null>(null);

  useEffect(() => {
    if (!dbStartedAt) {
      setAnchorMs(null);
      return;
    }

    const fresh = searchParams.get("fresh") === "1";
    let anchor: number;

    if (fresh) {
      anchor = Date.now();
      setWorkoutTimerAnchor(sessionId, anchor);
      router.replace(`/dashboard/workout/session/${sessionId}`, { scroll: false });
    } else {
      anchor =
        getWorkoutTimerAnchor(sessionId) ?? new Date(dbStartedAt).getTime();
      setWorkoutTimerAnchor(sessionId, anchor);
    }

    setAnchorMs(anchor);
  }, [dbStartedAt, router, searchParams, sessionId]);

  return anchorMs;
}

function WorkoutTimerCard({
  anchorMs,
  exercises,
}: {
  anchorMs: number | null;
  exercises: WorkoutSessionExercise[];
}) {
  const platform = usePlatformCopy();
  const elapsedSeconds = useElapsedSeconds(anchorMs);
  const estimatedSeconds = useMemo(
    () => estimateWorkoutDurationSeconds(exercises),
    [exercises]
  );
  const remainingSeconds = Math.max(0, estimatedSeconds - elapsedSeconds);

  if (exercises.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums tracking-tight">
              {formatElapsedClock(elapsedSeconds)}
            </p>
            <p className="text-xs text-muted-foreground">{platform.workout.elapsed}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">
            {platform.workout.estTotal(formatWorkoutDurationShort(estimatedSeconds))}
          </p>
          <p className="text-xs text-muted-foreground">
            {platform.workout.timeRemaining(formatWorkoutDurationShort(remainingSeconds))}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkoutFinishSummary({
  anchorMs,
  exercises,
  session,
}: {
  anchorMs: number | null;
  exercises: WorkoutSessionExercise[];
  session: WorkoutSession;
}) {
  const platform = usePlatformCopy();
  const elapsedSeconds = useElapsedSeconds(anchorMs);
  const estimatedSeconds = estimateWorkoutDurationSeconds(exercises);
  const { exerciseCount, totalSets, loggedSets } = getWorkoutSetStats(exercises);

  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-4">
      <p className="text-sm font-semibold">{platform.workout.finishSummaryTitle}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{platform.workout.elapsed}</dt>
          <dd className="font-medium tabular-nums">
            {formatElapsedClock(elapsedSeconds)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{platform.workout.estimatedTime}</dt>
          <dd className="font-medium">
            {formatWorkoutDurationShort(estimatedSeconds)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{platform.workout.exercisesTile}</dt>
          <dd className="font-medium">{platform.common.exercises(exerciseCount)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{platform.workout.set}</dt>
          <dd className="font-medium">
            {platform.workout.setsLogged(loggedSets, totalSets)}
          </dd>
        </div>
        {session.plan_title && (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">{platform.workout.flowProgram}</dt>
            <dd className="font-medium">
              {session.plan_title}
              {session.day_title ? ` · ${session.day_title}` : ""}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function SessionExerciseCard({
  exercise,
  history,
  onSetsChange,
  onSaveError,
  readOnly = false,
}: {
  exercise: WorkoutSessionExercise;
  history: ExerciseHistoryEntry | null;
  onSetsChange: (sets: WorkoutSessionSet[]) => void;
  onSaveError?: (message: string) => void;
  readOnly?: boolean;
}) {
  const platform = usePlatformCopy();
  const units = useBodyUnits();
  const [isAddingSet, setIsAddingSet] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [weightDrafts, setWeightDrafts] = useState<Record<string, string>>({});
  const historyLabel = formatHistory(
    history,
    platform.workout.lastSets,
    units.unitSystem
  );
  const hasVideo = !!exercise.video_url;
  const sets = exercise.sets ?? [];

  const parseRepsField = (rawValue: string) =>
    rawValue === "" ? null : parseInt(rawValue, 10);

  const parseWeightField = (rawValue: string) =>
    rawValue === "" ? null : units.parseWeightInput(rawValue);

  const weightDisplay = (set: WorkoutSessionSet) => {
    if (set.id in weightDrafts) return weightDrafts[set.id];
    return set.weight_kg != null
      ? units.formatWeightKg(Number(set.weight_kg))
      : "";
  };

  const updateSetField = (
    setId: string,
    field: "reps" | "weight_kg",
    parsed: number | null
  ) => {
    const nextSets = sets.map((set) => {
      if (set.id !== setId) return set;
      const next = { ...set, [field]: parsed };
      next.completed = next.reps != null || next.weight_kg != null;
      return next;
    });
    onSetsChange(nextSets);
  };

  const persistSetField = (
    setId: string,
    field: "reps" | "weight_kg",
    rawValue: string
  ) => {
    const parsed =
      field === "reps" ? parseRepsField(rawValue) : parseWeightField(rawValue);
    if (rawValue !== "" && (parsed == null || Number.isNaN(parsed))) return;

    const currentSet = sets.find((set) => set.id === setId);
    if (!currentSet) return;

    const reps = field === "reps" ? parsed : currentSet.reps;
    const weight_kg =
      field === "weight_kg"
        ? parsed
        : currentSet.weight_kg != null
          ? Number(currentSet.weight_kg)
          : null;
    const completed = reps != null || weight_kg != null;

    updateSetField(setId, field, parsed);

    void updateSessionSet(setId, {
      reps,
      weight_kg,
      completed,
    }).then((result) => {
      if (result.error) onSaveError?.(result.error);
    });
  };

  const handleAddSet = () => {
    setIsAddingSet(true);
    void addSessionSet(exercise.id).then((result) => {
      setIsAddingSet(false);
      if (result.error) {
        onSaveError?.(result.error);
        return;
      }
      if (result.data) {
        onSetsChange([...sets, result.data]);
      }
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base">{exercise.name}</CardTitle>
            {exercise.notes && (
              <p className="mt-1 text-sm text-muted-foreground">{exercise.notes}</p>
            )}
            {historyLabel && (
              <p className="mt-1.5 text-xs font-medium text-primary">{historyLabel}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasVideo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowVideo((v) => !v)}
              >
                <Play className="mr-1 h-3.5 w-3.5" />
                {showVideo ? platform.workout.hideVideo : platform.workout.preview}
              </Button>
            )}
            <Badge variant="secondary">
              {platform.workout.setsTarget(exercise.target_sets)}
            </Badge>
            <Badge variant="outline">
              {platform.workout.repsTarget(exercise.target_reps)}
            </Badge>
          </div>
        </div>
        {showVideo && hasVideo && (
          <div className="mt-3">
            <ExerciseVideoPlayer videoUrl={exercise.video_url} title={exercise.name} />
          </div>
        )}
      </CardHeader>
      {!readOnly && (
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground">
          <span>{platform.workout.set}</span>
          <span>{platform.workout.reps}</span>
          <span>{units.weightFieldLabel}</span>
        </div>
        {sets.map((set) => (
          <div
            key={set.id}
            className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2"
          >
            <span className="text-sm font-semibold text-muted-foreground">
              {set.set_number}
            </span>
            <Input
              type="number"
              inputMode="numeric"
              placeholder={exercise.target_reps}
              value={set.reps ?? ""}
              onChange={(e) => {
                const parsed = parseRepsField(e.target.value);
                if (
                  e.target.value !== "" &&
                  (parsed == null || Number.isNaN(parsed))
                ) {
                  return;
                }
                updateSetField(set.id, "reps", parsed);
              }}
              onBlur={(e) => persistSetField(set.id, "reps", e.target.value)}
              className="h-9"
            />
            <Input
              type="number"
              inputMode="decimal"
              step="0.5"
              placeholder="—"
              value={weightDisplay(set)}
              onChange={(e) =>
                setWeightDrafts((prev) => ({
                  ...prev,
                  [set.id]: e.target.value,
                }))
              }
              onBlur={(e) => {
                setWeightDrafts((prev) => {
                  const next = { ...prev };
                  delete next[set.id];
                  return next;
                });
                persistSetField(set.id, "weight_kg", e.target.value);
              }}
              className="h-9"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isAddingSet}
          onClick={handleAddSet}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {platform.workout.addSet}
        </Button>
      </CardContent>
      )}
    </Card>
  );
}

export function ActiveWorkoutClient({
  session,
  exercises: initialExercises,
  histories: initialHistories,
}: {
  session: WorkoutSession;
  exercises: WorkoutSessionExercise[];
  histories?: Record<string, ExerciseHistoryEntry | null>;
}) {
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const router = useRouter();
  const { patchDashboard, notifySync } = useDashboardSync();
  const [newExerciseName, setNewExerciseName] = useState("");
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showCompleteStep, setShowCompleteStep] = useState(false);
  const [sessionNote, setSessionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [exercises, setExercises] = useState(initialExercises);
  const [histories, setHistories] = useState<Record<string, ExerciseHistoryEntry | null>>(
    initialHistories ?? {}
  );
  const { confirm: confirmGiveUp, dialog: giveUpDialog, isPending: isGivingUp } =
    useSarcasticConfirm();
  const isStarted = session.started_at != null;
  const timerAnchorMs = useWorkoutTimerAnchor(session.id, session.started_at);

  useEffect(() => {
    setExercises(initialExercises);
  }, [initialExercises]);

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

  const handleBeginWorkout = () => {
    setError(null);
    startTransition(async () => {
      const result = await beginWorkoutSession(session.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/dashboard/workout/session/${session.id}?fresh=1`);
      router.refresh();
    });
  };

  const handleStopWorkout = () => {
    confirmGiveUp({
      ...coachCopy.discardWorkout,
      onConfirm: async () => {
        await cancelWorkoutSession(session.id);
        clearWorkoutTimerAnchor(session.id);
        router.push("/dashboard");
        router.refresh();
      },
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

  const handleFinishWorkout = (withNote: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await completeWorkoutSession(
        session.id,
        withNote ? sessionNote : null
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      clearWorkoutTimerAnchor(session.id);
      const dateKey =
        result.scheduledDate ??
        session.scheduled_date ??
        formatDateKey(new Date());
      notifySync();
      patchDashboard({
        dateKey,
        taskId: result.taskId,
        completed: true,
        workoutSessionId: session.id,
      });
      router.push("/dashboard");
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <div className="flex flex-col gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {platform.common.back}
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {isStarted ? platform.workout.stillInGym : platform.workout.readyToStart}
            </p>
            <h1 className="text-2xl font-black">
              {session.day_title ?? platform.workout.fallbackTitle}
            </h1>
            {session.plan_title && (
              <p className="text-sm text-muted-foreground">{session.plan_title}</p>
            )}
          </div>
          {isStarted && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 shrink-0 rounded-full px-3 text-xs font-semibold"
              disabled={isPending || isGivingUp}
              onClick={handleStopWorkout}
              aria-label={platform.workout.stopWorkout}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              {platform.workout.stop}
            </Button>
          )}
        </div>
      </div>

      {isStarted && (
        <WorkoutTimerCard anchorMs={timerAnchorMs} exercises={exercises} />
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-4">
        {exercises.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="space-y-1 p-6 text-center">
              <p className="font-medium">{platform.workout.noExercisesTitle}</p>
              <p className="text-sm text-muted-foreground">
                {platform.workout.noExercisesHint}
              </p>
            </CardContent>
          </Card>
        ) : (
          exercises.map((exercise) => {
            const historyKey = exercise.exercise_id ?? exercise.name;
            return (
              <SessionExerciseCard
                key={exercise.id}
                exercise={exercise}
                history={histories[historyKey] ?? null}
                onSetsChange={(sets) => patchExerciseSets(exercise.id, sets)}
                onSaveError={setError}
                readOnly={!isStarted}
              />
            );
          })
        )}
      </div>

      {isStarted &&
        (showAddExercise ? (
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
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
                <Button onClick={handleAddExercise} disabled={isPending || !newExerciseName.trim()}>
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
            </CardContent>
          </Card>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowAddExercise(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {platform.workout.addExercise}
          </Button>
        ))}

      <div className="space-y-4 border-t border-border pt-6">
        {!isStarted ? (
          <StartWorkoutLoadingShell isLoading={isPending} className="w-full">
            <Button
              size="lg"
              className="w-full"
              disabled={isPending}
              onClick={handleBeginWorkout}
              aria-busy={isPending}
            >
              <Play className="mr-2 h-4 w-4" />
              {isPending ? platform.common.saving : platform.workout.startWorkout}
            </Button>
          </StartWorkoutLoadingShell>
        ) : showCompleteStep ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{coachLabels.actuallyFinish}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {platform.workout.finishNote}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <WorkoutFinishSummary
                anchorMs={timerAnchorMs}
                exercises={exercises}
                session={session}
              />
              <div className="space-y-1">
                <Label htmlFor="session-note">{platform.workout.noteOptional}</Label>
                <Textarea
                  id="session-note"
                  placeholder={platform.workout.notePlaceholder}
                  value={sessionNote}
                  onChange={(e) => setSessionNote(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1"
                  disabled={isPending}
                  onClick={() => handleFinishWorkout(!!sessionNote.trim())}
                >
                  <Check className="mr-1 h-4 w-4" />
                  {isPending
                    ? platform.common.saving
                    : sessionNote.trim()
                      ? platform.workout.saveWithNote
                      : platform.workout.finishWorkout}
                </Button>
                {sessionNote.trim() && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={isPending}
                    onClick={() => handleFinishWorkout(false)}
                  >
                    {platform.workout.finishWithoutNote}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => setShowCompleteStep(false)}
                >
                  {platform.common.back}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button
            size="lg"
            className="w-full"
            disabled={isPending}
            onClick={() => setShowCompleteStep(true)}
          >
            <Check className="mr-2 h-4 w-4" />
            {coachLabels.actuallyFinish}
          </Button>
        )}
      </div>

      {giveUpDialog}
    </div>
  );
}
