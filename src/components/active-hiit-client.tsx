"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import Link from "next/link";
import {
  beginWorkoutSession,
  cancelWorkoutSession,
  completeWorkoutSession,
  skipDayFlowSession,
} from "@/lib/actions/workout-sessions";
import {
  buildHiitPhases,
  formatHiitClock,
  type HiitConfig,
  type HiitPhase,
  type HiitPhaseType,
  type WorkoutPlanKind,
} from "@/lib/hiit";
import {
  getHiitSoundsMuted,
  playHiitComplete,
  playHiitPhaseChange,
  playHiitStart,
  playHiitTick,
  setHiitSoundsMuted,
  unlockHiitAudio,
} from "@/lib/hiit-sounds";
import {
  advanceHiitPhase,
  clearHiitTimerState,
  getHiitElapsedMs,
  getHiitTimerState,
  getPhaseRemainingMs,
  hiitConfigHash,
  pauseHiitTimer,
  resetHiitTimer,
  resumeHiitTimer,
  startHiitTimer,
  type HiitTimerState,
} from "@/lib/hiit-timer-storage";
import { formatUserError } from "@/lib/format-user-error";
import { useDashboardSync } from "@/components/dashboard-sync";
import { DayFlowProgress } from "@/components/day-flow-progress";
import { ExerciseGifThumbnail } from "@/components/exercise-gif-thumbnail";
import {
  isWarmupPlanKind,
  useDayWorkoutFlowContinue,
} from "@/components/day-workout-flow";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import type { WorkoutSession } from "@/lib/types";
import { cn, formatDateKey } from "@/lib/utils";

function phaseTheme(type: HiitPhaseType) {
  switch (type) {
    case "work":
      return {
        glow: "bg-gradient-to-b from-primary/20 to-transparent",
        badge: "border-primary/35 bg-primary/15 text-primary",
        timer: "text-primary",
        ringTrack: "stroke-primary/20",
        ringProgress: "stroke-primary",
      };
    case "rest":
      return {
        glow: "bg-gradient-to-b from-emerald-500/15 to-transparent",
        badge: "border-emerald-500/35 bg-emerald-500/15 text-emerald-400",
        timer: "text-emerald-400",
        ringTrack: "stroke-emerald-500/20",
        ringProgress: "stroke-emerald-400",
      };
    case "round_rest":
      return {
        glow: "bg-gradient-to-b from-sky-500/15 to-transparent",
        badge: "border-sky-500/35 bg-sky-500/15 text-sky-400",
        timer: "text-sky-400",
        ringTrack: "stroke-sky-500/20",
        ringProgress: "stroke-sky-400",
      };
    case "cycle_rest":
      return {
        glow: "bg-gradient-to-b from-violet-500/15 to-transparent",
        badge: "border-violet-500/35 bg-violet-500/15 text-violet-400",
        timer: "text-violet-400",
        ringTrack: "stroke-violet-500/20",
        ringProgress: "stroke-violet-400",
      };
    case "prepare":
      return {
        glow: "bg-gradient-to-b from-amber-400/15 to-transparent",
        badge: "border-amber-400/35 bg-amber-400/15 text-amber-400",
        timer: "text-amber-400",
        ringTrack: "stroke-amber-400/25",
        ringProgress: "stroke-amber-400",
      };
    default:
      return {
        glow: "bg-transparent",
        badge: "border-border bg-secondary/60 text-muted-foreground",
        timer: "text-foreground",
        ringTrack: "stroke-muted-foreground/25",
        ringProgress: "stroke-foreground",
      };
  }
}

function HiitCountdownRing({
  progress,
  trackClass,
  progressClass,
  children,
}: {
  progress: number;
  trackClass: string;
  progressClass: string;
  children: ReactNode;
}) {
  const size = 220;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);

  return (
    <div className="relative mx-auto aspect-square h-[min(32dvh,12.5rem)] w-[min(32dvh,12.5rem)] shrink-0">
      <svg
        className="absolute inset-0 h-full w-full -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={trackClass}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(progressClass, "transition-[stroke-dashoffset] duration-100 ease-linear")}
        />
      </svg>
      <div className="relative z-[1] flex h-full w-full flex-col items-center justify-center px-4 text-center">
        {children}
      </div>
    </div>
  );
}

function useHiitClock(state: HiitTimerState | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state?.status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [state?.status]);

  return {
    remainingMs: getPhaseRemainingMs(state, now),
    elapsedMs: getHiitElapsedMs(state, now),
    now,
  };
}

export function ActiveHiitClient({
  session,
  config,
  planKind = "hiit",
  gender,
}: {
  session: WorkoutSession;
  config: HiitConfig;
  planKind?: WorkoutPlanKind;
  gender?: string | null;
}) {
  const router = useRouter();
  const platform = usePlatformCopy();
  const { notifySync, patchDashboard } = useDashboardSync();
  const {
    handleAfterComplete,
    StretchOfferDialog,
    isContinuing,
  } = useDayWorkoutFlowContinue();
  const [timer, setTimer] = useState<HiitTimerState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const advancingRef = useRef(false);
  const lastTickSecondRef = useRef<number | null>(null);
  const lastPhaseSoundRef = useRef<number | null>(null);
  const phases = buildHiitPhases(config);
  const hash = hiitConfigHash(config);
  const { remainingMs, elapsedMs } = useHiitClock(timer);
  const isWarmup = isWarmupPlanKind(planKind);
  const isStretch = planKind === "stretch";
  const showDayFlow = isWarmup || isStretch || planKind === "hiit";
  const sessionLabel =
    planKind === "warmup"
      ? platform.workout.sessionTypeWarmup
      : planKind === "stretch"
        ? platform.workout.sessionTypeStretch
        : "HIIT";
  const skipLabel = isWarmup
    ? platform.workout.skipToMainWorkout
    : isStretch
      ? platform.workout.skipStretch
      : platform.workout.skipSession;

  const phaseIndex = timer?.phaseIndex ?? 0;
  const phase: HiitPhase =
    phases[Math.min(phaseIndex, phases.length - 1)] ?? phases[0];
  const nextPhase =
    phases[phaseIndex + 1] && phases[phaseIndex + 1].type !== "done"
      ? phases[phaseIndex + 1]
      : null;
  const theme = phaseTheme(phase?.type ?? "prepare");
  const isIdle = !timer || timer.status === "idle";
  const isRunning = timer?.status === "running";
  const isDone = timer?.status === "completed" || phase?.type === "done";
  const roundsRemaining = phase
    ? isDone
      ? 0
      : Math.max(
          0,
          phase.totalRounds -
            phase.round +
            (phase.type === "round_rest" || phase.type === "cycle_rest" ? 0 : 1)
        )
    : 0;
  const cyclesRemaining = phase
    ? isDone
      ? 0
      : Math.max(
          0,
          phase.totalCycles -
            phase.cycle +
            (phase.type === "cycle_rest" ? 0 : 1)
        )
    : 0;

  useEffect(() => {
    const existing = getHiitTimerState(session.id);
    if (existing && existing.configHash === hash) {
      setTimer(existing);
    } else if (existing) {
      clearHiitTimerState(session.id);
    }
    setMuted(getHiitSoundsMuted());
    setHydrated(true);
  }, [session.id, hash]);

  const goToPhase = (nextIndex: number, { playSound = true } = {}) => {
    const next = phases[nextIndex];
    lastTickSecondRef.current = null;
    if (!next || next.type === "done") {
      const done = advanceHiitPhase(session.id, nextIndex, 0, true);
      setTimer(done);
      if (playSound && lastPhaseSoundRef.current !== nextIndex) {
        lastPhaseSoundRef.current = nextIndex;
        playHiitComplete();
      }
      return;
    }
    const advanced = advanceHiitPhase(
      session.id,
      nextIndex,
      next.durationSeconds * 1000,
      false
    );
    setTimer(advanced);
    if (playSound && lastPhaseSoundRef.current !== nextIndex) {
      lastPhaseSoundRef.current = nextIndex;
      playHiitPhaseChange(next.type);
    }
  };

  useEffect(() => {
    if (!hydrated || !timer || timer.status !== "running") return;
    if (remainingMs > 0) return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    goToPhase(timer.phaseIndex + 1);
    advancingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- advance on phase expiry only
  }, [hydrated, timer, remainingMs]);

  // Countdown ticks for the last 5 seconds of any phase.
  useEffect(() => {
    if (!hydrated || !timer || timer.status !== "running" || isDone) return;
    const secondsLeft = Math.ceil(remainingMs / 1000);
    if (secondsLeft < 1 || secondsLeft > 5) {
      if (secondsLeft > 5) lastTickSecondRef.current = null;
      return;
    }
    if (lastTickSecondRef.current === secondsLeft) return;
    lastTickSecondRef.current = secondsLeft;
    playHiitTick(secondsLeft);
  }, [hydrated, timer, remainingMs, isDone]);

  const handleStart = () => {
    setError(null);
    unlockHiitAudio();
    playHiitStart();
    startTransition(async () => {
      if (!session.started_at) {
        const result = await beginWorkoutSession(session.id);
        if (result && "error" in result && result.error) {
          setError(formatUserError(result.error));
          return;
        }
      }
      const first = phases.find((p) => p.type !== "done") ?? phases[0];
      if (!first) return;
      lastTickSecondRef.current = null;
      lastPhaseSoundRef.current = 0;
      setTimer(startHiitTimer(session.id, first.durationSeconds * 1000, hash));
    });
  };

  const handlePause = () => {
    setTimer(pauseHiitTimer(session.id));
  };

  const handleResume = () => {
    unlockHiitAudio();
    lastTickSecondRef.current = null;
    setTimer(resumeHiitTimer(session.id));
  };

  const handleSkip = () => {
    if (!timer || isDone) return;
    goToPhase(timer.phaseIndex + 1);
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setHiitSoundsMuted(next);
    if (!next) unlockHiitAudio();
  };

  const handleReset = () => {
    resetHiitTimer(session.id);
    lastTickSecondRef.current = null;
    lastPhaseSoundRef.current = null;
    setTimer(null);
  };

  const handleComplete = () => {
    setError(null);
    if (timer?.status === "running") {
      setTimer(pauseHiitTimer(session.id));
    }
    startTransition(async () => {
      const result = await completeWorkoutSession(session.id);
      if (result && "error" in result && result.error) {
        setError(formatUserError(result.error));
        return;
      }
      clearHiitTimerState(session.id);
      const dateKey =
        ("scheduledDate" in result && result.scheduledDate) ||
        session.scheduled_date ||
        formatDateKey(new Date());
      notifySync();
      if ("taskId" in result && result.taskId) {
        patchDashboard({
          dateKey,
          taskId: result.taskId,
          completed: true,
          workoutSessionId: session.id,
        });
      }
      const flow = handleAfterComplete({
        scheduledDate: dateKey,
        taskId: "taskId" in result ? result.taskId : undefined,
        planKind: "planKind" in result ? result.planKind : planKind,
        nextWorkout: "nextWorkout" in result ? result.nextWorkout : null,
      });
      if (flow === "done") {
        router.refresh();
      }
    });
  };

  const handleSkipToMain = () => {
    setError(null);
    startTransition(async () => {
      const result = await skipDayFlowSession(session.id);
      if (result && "error" in result && result.error) {
        setError(formatUserError(result.error));
        return;
      }
      clearHiitTimerState(session.id);
      notifySync();
      if (result && "sessionId" in result && result.sessionId) {
        router.push(`/dashboard/workout/session/${result.sessionId}`);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  };

  const handleCancel = () => {
    setError(null);
    startTransition(async () => {
      await cancelWorkoutSession(session.id);
      clearHiitTimerState(session.id);
      notifySync();
      router.push("/dashboard");
      router.refresh();
    });
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-muted-foreground">
        Loading timer…
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-lg font-bold">No exercises in this workout</p>
        <p className="text-sm text-muted-foreground">
          Add exercises to the HIIT plan, then try again.
        </p>
        <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
          Back
        </Button>
      </div>
    );
  }

  const countdown = formatHiitClock(Math.ceil(remainingMs / 1000));
  const totalElapsed = formatHiitClock(Math.floor(elapsedMs / 1000));
  const phaseDurationMs = Math.max(1, (phase?.durationSeconds ?? 1) * 1000);
  const idlePreviewMs = (phases[0]?.durationSeconds ?? 0) * 1000;
  const ringProgress = isDone
    ? 0
    : isIdle
      ? 1
      : Math.min(1, Math.max(0, remainingMs / phaseDurationMs));
  const headline =
    phase?.type === "work"
      ? phase.exerciseName ?? "Work"
      : phase?.type === "prepare"
        ? phase.exerciseName ?? phase?.label ?? "Prepare"
        : phase?.label ?? "HIIT";
  const phaseEyebrow =
    phase?.type === "prepare"
      ? platform.workout.getReadyFor
      : phase?.type === "work"
        ? "Work"
        : phase?.label;
  const showHeadline =
    Boolean(headline) &&
    headline.trim().toLowerCase() !== (phaseEyebrow ?? "").trim().toLowerCase();
  const nextLabel =
    phase?.nextExerciseName ??
    nextPhase?.exerciseName ??
    (nextPhase?.type === "round_rest"
      ? "Round rest"
      : nextPhase?.type === "cycle_rest"
        ? "Cycle rest"
        : nextPhase?.label);
  const upNextExerciseName =
    phase?.type === "work" && phase.nextExerciseName
      ? phase.nextExerciseName
      : nextPhase?.type === "work"
        ? nextPhase.exerciseName
        : phase?.nextExerciseName ?? nextPhase?.exerciseName ?? null;
  const upNextExercise = upNextExerciseName
    ? (config.exercises.find((ex) => ex.name === upNextExerciseName) ?? null)
    : null;
  const showUpNextPreview =
    Boolean(upNextExerciseName) && nextPhase?.type === "work";
  const upNextHeadline =
    phase?.type === "work" && phase.nextExerciseName
      ? `Rest → ${phase.nextExerciseName}`
      : nextLabel;

  const playLabel = isDone ? "Done" : isIdle ? "Start" : isRunning ? "Pause" : "Resume";

  return (
    <div className="fixed inset-0 z-[200] flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-10 flex shrink-0 flex-col gap-2 border-b border-border/60 bg-background/95 px-3 pb-2.5 pt-[max(0.5rem,var(--safe-area-top))] backdrop-blur-md">
        <div className="relative flex h-11 items-center justify-between gap-2">
          <Link
            href="/dashboard"
            className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-secondary/80 text-foreground transition hover:bg-secondary"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="pointer-events-none absolute inset-x-12 top-1/2 z-0 -translate-y-1/2 text-center">
            <p className="flex items-center justify-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-primary">
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{sessionLabel}</span>
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
              {totalElapsed}
            </p>
          </div>

          <div className="relative z-10 flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={handleToggleMute}
              aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={handleReset}
              disabled={isIdle || isPending}
              aria-label="Reset"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={handleCancel}
              disabled={isPending}
              aria-label="Exit"
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showDayFlow ? (
          <DayFlowProgress currentKind={planKind} compact className="px-0.5" />
        ) : null}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-40 transition-colors duration-300",
            theme.glow
          )}
          aria-hidden
        />

        <div className="relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-4 py-4">
          <span
            className={cn(
              "inline-flex rounded-full border px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.2em]",
              theme.badge
            )}
          >
            {phaseEyebrow}
          </span>

          {showHeadline ? (
            <h1 className="line-clamp-2 max-w-full text-center text-xl font-black uppercase leading-tight tracking-tight sm:text-2xl">
              {headline}
            </h1>
          ) : null}

          <HiitCountdownRing
            progress={ringProgress}
            trackClass={theme.ringTrack}
            progressClass={theme.ringProgress}
          >
            <p
              className={cn(
                "font-mono text-[2.75rem] font-black leading-none tracking-tighter sm:text-5xl",
                theme.timer
              )}
            >
              {isDone
                ? "00:00"
                : isIdle
                  ? formatHiitClock(Math.floor(idlePreviewMs / 1000))
                  : countdown}
            </p>
          </HiitCountdownRing>
        </div>
      </div>

      {!isDone && nextLabel ? (
        <div className="mx-3 mb-2 shrink-0 rounded-2xl border border-border/60 bg-card/80 px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            {showUpNextPreview ? (
              <ExerciseGifThumbnail
                name={upNextExerciseName!}
                imageUrl={upNextExercise?.image_url}
                videoUrl={upNextExercise?.video_url}
                gender={gender}
                size="md"
                expandable
                className="shrink-0"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Up next
              </p>
              <p className="mt-0.5 line-clamp-1 text-sm font-black uppercase tracking-tight text-foreground">
                {upNextHeadline}
              </p>
            </div>
            {nextPhase && nextPhase.type !== "done" ? (
              <p className="shrink-0 font-mono text-sm font-bold tabular-nums text-muted-foreground">
                {formatHiitClock(nextPhase.durationSeconds)}
              </p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 shrink-0 gap-1.5 rounded-full px-3"
              disabled={isIdle || isDone || isPending}
              onClick={handleSkip}
            >
              <SkipForward className="h-3.5 w-3.5" />
              Skip
            </Button>
          </div>
        </div>
      ) : (
        <div className="mx-3 mb-2 shrink-0 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-emerald-400">
            Finished
          </p>
          <p className="text-lg font-black uppercase text-foreground">Great work</p>
        </div>
      )}

      <div className="flex shrink-0 flex-col gap-3 border-t border-border/60 bg-card/60 px-4 pb-[max(0.75rem,var(--safe-area-bottom))] pt-3 backdrop-blur-md">
        <div className="grid grid-cols-3 items-center gap-2">
          <div>
            <p className="font-mono text-2xl font-black tabular-nums text-sky-400">
              {Math.max(0, roundsRemaining)}
            </p>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Rounds left
            </p>
          </div>
          <div className="flex flex-col items-center">
            {isDone ? (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/15 text-emerald-400"
                aria-hidden
              >
                <Check className="h-7 w-7" strokeWidth={2.5} />
              </div>
            ) : (
              <button
                type="button"
                onClick={isIdle ? handleStart : isRunning ? handlePause : handleResume}
                disabled={isIdle && isPending}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_4px_rgba(var(--primary-rgb),0.18)] transition hover:opacity-95 active:scale-[0.97]"
                aria-label={playLabel}
              >
                {isRunning ? (
                  <Pause className="h-6 w-6 fill-current" />
                ) : (
                  <Play className="h-6 w-6 fill-current" />
                )}
              </button>
            )}
            <p
              className={cn(
                "mt-1.5 text-[0.65rem] font-bold uppercase tracking-[0.2em]",
                isDone ? "text-emerald-400" : "text-primary"
              )}
            >
              {playLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-black tabular-nums text-violet-400">
              {Math.max(0, cyclesRemaining)}
            </p>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Cycles left
            </p>
          </div>
        </div>

        {!isIdle ? (
          <Button
            type="button"
            size="lg"
            className="h-12 w-full shrink-0 gap-2 rounded-full text-base font-black uppercase tracking-wide"
            disabled={isPending || isContinuing}
            onClick={handleComplete}
          >
            {isPending || isContinuing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check className="h-5 w-5" strokeWidth={2.5} />
                Complete workout
              </>
            )}
          </Button>
        ) : null}
        {isWarmup || isStretch ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="h-11 w-full shrink-0 gap-2 rounded-full text-sm font-semibold"
            disabled={isPending}
            onClick={handleSkipToMain}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SkipForward className="h-4 w-4" />
            )}
            {skipLabel}
          </Button>
        ) : null}
        {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
      </div>
      {StretchOfferDialog}
    </div>
  );
}
