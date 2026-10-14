"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2, Minus, Plus } from "lucide-react";
import { useBodyUnits, usePlatformCopy } from "@/components/locale-provider";
import { ExerciseDemoPlayer } from "@/components/exercise-demo-player";
import { Button } from "@/components/ui/button";
import {
  addSessionSet,
  getInProgressSession,
  getWorkoutSession,
  updateSessionSet,
} from "@/lib/actions/workout-sessions";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { resolveExerciseGifUrl, resolveProfileGender } from "@/lib/exercise-gif";
import {
  currentLiveDraft,
  endLiveWorkout,
  useLiveWorkoutPublisher,
} from "@/lib/live-workout";
import type { WorkoutSessionExercise, WorkoutSessionSet } from "@/lib/types";
import { cn } from "@/lib/utils";

function openSet(exercise: WorkoutSessionExercise | undefined) {
  const sets = exercise?.sets ?? [];
  return (
    sets.find((set) => !set.completed && set.reps == null && set.weight_kg == null) ??
    null
  );
}

function suggestedReps(
  exercise: WorkoutSessionExercise | undefined,
  previous: number | null
) {
  if (previous != null) return previous;
  const match = String(exercise?.target_reps ?? "").match(/\d+/);
  const parsed = match ? parseInt(match[0], 10) : 8;
  return Math.min(40, Math.max(1, Number.isFinite(parsed) ? parsed : 8));
}

export function QuickWorkoutClient() {
  const platform = usePlatformCopy();
  const units = useBodyUnits();
  const router = useRouter();
  const searchParams = useSearchParams();
  const publishLive = useLiveWorkoutPublisher(true);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timerOnly, setTimerOnly] = useState(false);
  const [exercises, setExercises] = useState<WorkoutSessionExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [reps, setReps] = useState(8);
  const [weightKg, setWeightKg] = useState(20);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gender, setGender] = useState<"male" | "female" | null>(null);

  const exercise = exercises[index] ?? null;
  const current = openSet(exercise);
  const targetSets = Math.max(1, exercise?.target_sets || exercise?.sets?.length || 1);
  const completed = (exercise?.sets ?? []).filter(
    (set) => set.completed || set.reps != null || set.weight_kg != null
  ).length;
  const setNumber = current?.set_number ?? Math.min(completed + 1, targetSets);

  const seed = useCallback(
    (
      nextExercises: WorkoutSessionExercise[],
      nextIndex: number,
      draft: { setId: string; reps: number; weightKg: number } | null
    ) => {
      const item = nextExercises[nextIndex];
      const set = openSet(item);
      const previous = [...(item?.sets ?? [])]
        .reverse()
        .find((row) => row.completed || row.reps != null || row.weight_kg != null);
      const useDraft = Boolean(draft && set && draft.setId === set.id);
      setReps(
        useDraft && draft
          ? draft.reps
          : suggestedReps(item, previous?.reps ?? null)
      );
      setWeightKg(
        useDraft && draft
          ? draft.weightKg
          : previous?.weight_kg != null
            ? Number(previous.weight_kg)
            : 20
      );
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [session, profile, draft] = await Promise.all([
          getInProgressSession(),
          getSubscriptionProfile(),
          currentLiveDraft(),
        ]);
        if (cancelled) return;
        setGender(resolveProfileGender(profile?.gender) ?? null);
        if (!session?.started_at) {
          setSessionId(null);
          void endLiveWorkout();
          setLoading(false);
          return;
        }
        const details = await getWorkoutSession(session.id);
        if (cancelled) return;
        if (!details || details.hiitConfig || details.exercises.length === 0) {
          setSessionId(session.id);
          setTimerOnly(true);
          void endLiveWorkout();
          setLoading(false);
          return;
        }
        const requested = Number(searchParams.get("exercise"));
        const start = Number.isFinite(requested)
          ? requested
          : draft?.exerciseIndex ?? 0;
        const nextIndex = Math.min(
          Math.max(0, Math.round(start)),
          details.exercises.length - 1
        );
        setSessionId(session.id);
        setExercises(details.exercises);
        setIndex(nextIndex);
        seed(details.exercises, nextIndex, draft);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Couldn't open the set.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, seed]);

  useEffect(() => {
    if (!exercise || timerOnly) return;
    publishLive({
      exerciseName: exercise.name,
      exerciseIndex: index,
      exerciseCount: exercises.length,
      gifUrl: resolveExerciseGifUrl({
        name: exercise.name,
        imageUrl: exercise.image_url,
        gender,
      }),
      setId: current?.id ?? null,
      setNumber,
      setCount: targetSets,
      reps,
      weightKg,
    });
  }, [
    current?.id,
    exercise,
    exercises.length,
    gender,
    index,
    publishLive,
    reps,
    setNumber,
    targetSets,
    timerOnly,
    weightKg,
  ]);

  const move = (delta: number) => {
    const next = Math.min(exercises.length - 1, Math.max(0, index + delta));
    if (next === index) return;
    setIndex(next);
    seed(exercises, next, null);
  };

  const log = async () => {
    if (!exercise || saving) return;
    setSaving(true);
    setError(null);
    try {
      let setId = current?.id ?? null;
      let sets = exercise.sets ?? [];
      if (!setId) {
        const created = await addSessionSet(exercise.id);
        if (created.error || !created.data) {
          setError(created.error ?? "Couldn't add a set.");
          return;
        }
        sets = [...sets, created.data];
        setId = created.data.id;
      }
      const result = await updateSessionSet(setId, {
        reps,
        weight_kg: weightKg,
        completed: true,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      const nextSets: WorkoutSessionSet[] = sets.map((set) =>
        set.id === setId ? { ...set, reps, weight_kg: weightKg, completed: true } : set
      );
      const nextExercises = exercises.map((item) =>
        item.id === exercise.id ? { ...item, sets: nextSets } : item
      );
      const done = nextSets.filter(
        (set) => set.completed || set.reps != null || set.weight_kg != null
      ).length;
      const advance = done >= targetSets && index < nextExercises.length - 1;
      const nextIndex = advance ? index + 1 : index;
      setExercises(nextExercises);
      setIndex(nextIndex);
      seed(nextExercises, nextIndex, null);
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (window.history.length > 1) router.back();
    else router.push("/dashboard");
  };

  return (
    <div
      className="flex min-h-[100dvh] flex-col justify-end bg-black/55"
      data-native-pull-refresh="off"
    >
      <button
        type="button"
        className="min-h-16 flex-1"
        aria-label="Close"
        onClick={close}
      />
      <section className="max-h-[92dvh] overflow-y-auto rounded-t-[1.75rem] bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_60px_-30px_rgba(0,0,0,0.8)]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" aria-hidden />
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : !sessionId ? (
          <EmptyCopy
            title={platform.workout.quickSet}
            body={platform.workout.noWorkoutInProgress}
            closeLabel={platform.common.close}
            onClose={close}
          />
        ) : timerOnly ? (
          <EmptyCopy
            title={platform.workout.quickSet}
            body={platform.workout.quickTimerWorkout}
            actionHref={sessionId ? `/dashboard/workout/session/${sessionId}` : undefined}
            actionLabel={platform.workout.openWorkout}
            closeLabel={platform.common.close}
            onClose={close}
          />
        ) : exercise ? (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {platform.workout.exerciseOf(index + 1, exercises.length)}
              </p>
              <h1 className="text-lg font-black uppercase leading-tight tracking-tight">
                {exercise.name}
              </h1>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {platform.workout.setOf(setNumber, targetSets)}
              </p>
            </div>
            <div className="workout-demo-stage relative mx-auto h-[min(36vh,280px)] w-full max-w-[20rem] overflow-hidden rounded-[1.35rem] bg-white shadow-[0_18px_48px_-28px_rgba(0,0,0,0.85)]">
              <div className="absolute inset-0 [&_>div]:h-full [&_>div]:max-w-none [&_>div]:rounded-none [&_>div]:border-0 [&_*]:bg-white">
                <ExerciseDemoPlayer
                  name={exercise.name}
                  imageUrl={exercise.image_url}
                  videoUrl={exercise.video_url}
                  gender={gender}
                  autoplay
                  fill
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Stepper
                label={platform.workout.load}
                value={units.formatWeightKg(weightKg)}
                onDecrement={() => setWeightKg((value) => Math.max(0, value - 2.5))}
                onIncrement={() => setWeightKg((value) => Math.min(200, value + 2.5))}
                disabled={saving}
              />
              <Stepper
                label={platform.workout.reps}
                value={String(reps)}
                onDecrement={() => setReps((value) => Math.max(1, value - 1))}
                onIncrement={() => setReps((value) => Math.min(40, value + 1))}
                disabled={saving}
              />
            </div>
            {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full"
                disabled={index === 0 || saving}
                onClick={() => move(-1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                {platform.workout.previousExercise}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full"
                disabled={index >= exercises.length - 1 || saving}
                onClick={() => move(1)}
              >
                {platform.workout.nextExerciseAction}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              className="h-11 rounded-full bg-primary text-sm font-black uppercase tracking-[0.08em]"
              disabled={saving}
              onClick={() => void log()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="mr-1.5 h-4 w-4" strokeWidth={2.5} />
                  {platform.workout.finishSet(setNumber)}
                </>
              )}
            </Button>
            {sessionId ? (
              <button
                type="button"
                className="text-center text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => router.push(`/dashboard/workout/session/${sessionId}`)}
              >
                {platform.workout.openWorkout}
              </button>
            ) : null}
            <p className="pb-1 text-center text-[11px] leading-relaxed text-muted-foreground">
              {platform.workout.backTapHint}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
  disabled,
}: {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-border/50 bg-zinc-900/70 px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xl font-black tabular-nums leading-none">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={onDecrement}
          aria-label={`Decrease ${label}`}
          className={cn(
            "inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-border/60 bg-background/40"
          )}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onIncrement}
          aria-label={`Increase ${label}`}
          className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-border/60 bg-background/40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmptyCopy({
  title,
  body,
  actionHref,
  actionLabel,
  closeLabel,
  onClose,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
      <h1 className="text-lg font-black">{title}</h1>
      <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
      {actionHref && actionLabel ? (
        <Button type="button" className="rounded-full" onClick={() => router.push(actionHref)}>
          {actionLabel}
        </Button>
      ) : null}
      <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
        {closeLabel}
      </Button>
    </div>
  );
}
