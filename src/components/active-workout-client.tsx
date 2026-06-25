"use client";
import { useCoachCopy, useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, Play, Plus, Trash2 } from "lucide-react";
import {
  addSessionExercise,
  addSessionSet,
  cancelWorkoutSession,
  completeWorkoutSession,
  updateSessionSet,
} from "@/lib/actions/workout-sessions";
import type {
  ExerciseHistoryEntry,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionSet,
} from "@/lib/types";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { useDashboardSync } from "@/components/dashboard-sync";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { formatDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

function formatHistory(
  history: ExerciseHistoryEntry | null | undefined,
  lastLabel: (parts: string) => string
): string | null {
  if (!history?.sets.length) return null;
  const parts = history.sets
    .filter((s) => s.reps != null || s.weight_kg != null)
    .map((s) => {
      const reps = s.reps != null ? `${s.reps}` : "—";
      const weight = s.weight_kg != null ? `${s.weight_kg} kg` : "—";
      return `${reps} × ${weight}`;
    });
  if (parts.length === 0) return null;
  return lastLabel(parts.join(", "));
}

function SessionExerciseCard({
  exercise,
  history,
  onUpdate,
}: {
  exercise: WorkoutSessionExercise;
  history: ExerciseHistoryEntry | null;
  onUpdate: () => void;
}) {
  const platform = usePlatformCopy();
  const [isPending, startTransition] = useTransition();
  const [showVideo, setShowVideo] = useState(false);
  const historyLabel = formatHistory(history, platform.workout.lastSets);
  const hasVideo = !!exercise.video_url;

  const handleSetBlur = (
    set: WorkoutSessionSet,
    field: "reps" | "weight_kg",
    value: string
  ) => {
    const parsed =
      field === "reps"
        ? value === ""
          ? null
          : parseInt(value, 10) || 0
        : value === ""
          ? null
          : parseFloat(value) || 0;

    const current =
      field === "reps" ? set.reps : set.weight_kg != null ? Number(set.weight_kg) : null;
    if (parsed === current) return;

    startTransition(async () => {
      await updateSessionSet(set.id, {
        [field]: parsed,
        completed: parsed != null,
      });
      onUpdate();
    });
  };

  const handleAddSet = () => {
    startTransition(async () => {
      await addSessionSet(exercise.id);
      onUpdate();
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
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground">
          <span>{platform.workout.set}</span>
          <span>{platform.workout.reps}</span>
          <span>{platform.workout.weightKg}</span>
        </div>
        {(exercise.sets ?? []).map((set) => (
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
              defaultValue={set.reps ?? ""}
              disabled={isPending}
              onBlur={(e) => handleSetBlur(set, "reps", e.target.value)}
              className="h-9"
            />
            <Input
              type="number"
              inputMode="decimal"
              step="0.5"
              placeholder="—"
              defaultValue={set.weight_kg ?? ""}
              disabled={isPending}
              onBlur={(e) => handleSetBlur(set, "weight_kg", e.target.value)}
              className="h-9"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleAddSet}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {platform.workout.addSet}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ActiveWorkoutClient({
  session,
  exercises: initialExercises,
  histories,
}: {
  session: WorkoutSession;
  exercises: WorkoutSessionExercise[];
  histories: Record<string, ExerciseHistoryEntry | null>;
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
  const { confirm: confirmGiveUp, dialog: giveUpDialog, isPending: isGivingUp } =
    useSarcasticConfirm();

  const refresh = () => router.refresh();

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
      const dateKey = session.scheduled_date ?? formatDateKey(new Date());
      notifySync();
      patchDashboard({
        dateKey,
        taskId: `${dateKey}-workout`,
        completed: true,
        workoutCompleted: true,
      });
      router.push("/dashboard/workout");
    });
  };

  const handleCancel = () => {
    confirmGiveUp({
      ...coachCopy.discardWorkout,
      onConfirm: async () => {
        await cancelWorkoutSession(session.id);
        router.push("/dashboard/workout");
        router.refresh();
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <div className="flex flex-col gap-3">
        <Link href="/dashboard/workout">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {platform.common.back}
          </Button>
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {platform.workout.stillInGym}
            </p>
            <h1 className="text-2xl font-black">
              {session.day_title ?? platform.workout.fallbackTitle}
            </h1>
            {session.plan_title && (
              <p className="text-sm text-muted-foreground">{session.plan_title}</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending || isGivingUp}
            onClick={handleCancel}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {coachLabels.bailOnWorkout}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-4">
        {initialExercises.map((exercise) => {
          const historyKey = exercise.exercise_id ?? exercise.name;
          return (
            <SessionExerciseCard
              key={exercise.id}
              exercise={exercise}
              history={histories[historyKey] ?? null}
              onUpdate={refresh}
            />
          );
        })}
      </div>

      {showAddExercise ? (
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
      )}

      <div className="space-y-4 border-t border-border pt-6">
        {showCompleteStep ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{coachLabels.actuallyFinish}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {platform.workout.finishNote}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
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
