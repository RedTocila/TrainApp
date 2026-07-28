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
import {
  isWarmupPlanKind,
  useDayWorkoutFlowContinue,
} from "@/components/day-workout-flow";
import { ExerciseDemoDialog } from "@/components/exercise-demo-dialog";
import { ExerciseGifImage } from "@/components/exercise-gif-image";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { resolveExerciseGifUrls, resolveProfileGender } from "@/lib/exercise-gif";
import type { WorkoutSession } from "@/lib/types";
import { cn, formatDateKey } from "@/lib/utils";

function phaseTheme(type: HiitPhaseType) {
  switch (type) {
    case "work":
      return {
        panel: "bg-primary text-primary-foreground",
        next: "bg-emerald-500 text-black",
        accent: "text-primary-foreground/80",
        ring: "border-primary-foreground/40",
        ringTrack: "stroke-primary-foreground/25",
        ringProgress: "stroke-primary-foreground",
        control: "bg-black text-primary-foreground",
      };
    case "rest":
      return {
        panel: "bg-emerald-500 text-black",
        next: "bg-primary text-primary-foreground",
        accent: "text-black/70",
        ring: "border-black/30",
        ringTrack: "stroke-black/20",
        ringProgress: "stroke-black",
        control: "bg-black text-emerald-400",
      };
    case "round_rest":
    case "cycle_rest":
      return {
        panel: "bg-sky-500 text-black",
        next: "bg-primary text-primary-foreground",
        accent: "text-black/70",
        ring: "border-black/30",
        ringTrack: "stroke-black/20",
        ringProgress: "stroke-black",
        control: "bg-black text-sky-300",
      };
    case "prepare":
      return {
        panel: "bg-amber-400 text-black",
        next: "bg-primary text-primary-foreground",
        accent: "text-black/70",
        ring: "border-black/25",
        ringTrack: "stroke-black/20",
        ringProgress: "stroke-black",
        control: "bg-black text-amber-300",
      };
    default:
      return {
        panel: "bg-background text-foreground",
        next: "bg-secondary text-foreground",
        accent: "text-muted-foreground",
        ring: "border-border",
        ringTrack: "stroke-muted-foreground/30",
        ringProgress: "stroke-foreground",
        control: "bg-secondary text-foreground",
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
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);

  return (
    <div className="relative mx-auto aspect-square h-[min(38dvh,11.5rem)] w-[min(38dvh,11.5rem)] max-h-full shrink items-center justify-center">
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
  const [demoOpen, setDemoOpen] = useState(false);
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
  const nextLabel =
    phase?.nextExerciseName ??
    nextPhase?.exerciseName ??
    (nextPhase?.type === "round_rest"
      ? "Round rest"
      : nextPhase?.type === "cycle_rest"
        ? "Cycle rest"
        : nextPhase?.label);

  // Always resolve a demo exercise: current work, prepare target, or first in list.
  const demoFromPhaseName =
    phase?.type === "work" || phase?.type === "prepare" || phase?.type === "rest"
      ? phase.exerciseName ?? phase.nextExerciseName
      : phase?.nextExerciseName ?? config.exercises[0]?.name ?? null;
  const demoIndex =
    config.exercises.length === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            config.exercises.length - 1,
            phase?.exerciseIndex ?? 0
          )
        );
  const demoExercise =
    (demoFromPhaseName
      ? config.exercises.find(
          (exercise) =>
            exercise.name.trim().toLowerCase() ===
            demoFromPhaseName.trim().toLowerCase()
        )
      : null) ??
    config.exercises[demoIndex] ??
    (demoFromPhaseName
      ? {
          name: demoFromPhaseName,
          video_url: null,
          image_url: null,
          work_seconds: 0,
          rest_seconds: 0,
        }
      : null);
  const demoGif = demoExercise?.name
    ? resolveExerciseGifUrls({
        name: demoExercise.name,
        imageUrl: demoExercise.image_url,
        gender: resolveProfileGender(gender) ?? "male",
      })
    : null;
  const showDemo = Boolean(demoExercise?.name);

  return (
    <div className="fixed inset-0 z-[200] flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-col gap-2 px-3 pb-2 pt-[max(0.5rem,var(--safe-area-top))]">
        <div className="relative flex h-12 items-center justify-between gap-2">
          <Link
            href="/dashboard"
            className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/80 text-foreground"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="pointer-events-none absolute inset-x-12 top-1/2 z-0 -translate-y-1/2 text-center">
            <p className="flex items-center justify-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-orange-400">
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{sessionLabel}</span>
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {totalElapsed}
            </p>
          </div>

          <div className="relative z-10 flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handleToggleMute}
              aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
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
              className="h-9 w-9"
              onClick={handleCancel}
              disabled={isPending}
              aria-label="Exit"
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showDayFlow ? (
          <DayFlowProgress currentKind={planKind} className="px-1" />
        ) : null}
      </header>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-2 transition-colors",
          theme.panel
        )}
      >
        <p className={cn("text-center text-[0.65rem] font-bold uppercase tracking-[0.25em]", theme.accent)}>
          {phaseEyebrow}
        </p>
        <h1 className="line-clamp-2 max-w-full text-center text-lg font-black uppercase leading-tight tracking-tight sm:text-xl">
          {headline}
        </h1>
        {showDemo && demoExercise?.name ? (
          <button
            type="button"
            onClick={() => setDemoOpen(true)}
            className="group relative h-36 w-36 shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-md ring-offset-background transition hover:ring-2 hover:ring-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-40 sm:w-40"
            aria-label={`Preview ${demoExercise.name}`}
          >
            <ExerciseGifImage
              gifUrl={demoGif?.url}
              fallbackUrl={demoGif?.fallbackUrl}
              alt={demoExercise.name}
              className="h-full w-full"
              imgClassName="absolute inset-0 object-contain"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition group-hover:bg-black/30">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 shadow-sm transition group-hover:bg-black/55 group-hover:scale-105">
                <Play className="h-5 w-5 fill-white text-white opacity-75 drop-shadow transition group-hover:opacity-100" />
              </span>
            </span>
            <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              {platform.workout.preview}
            </span>
          </button>
        ) : null}
        <HiitCountdownRing
          progress={ringProgress}
          trackClass={theme.ringTrack}
          progressClass={theme.ringProgress}
        >
          <p className="font-mono text-[2.75rem] font-black leading-none tracking-tighter sm:text-5xl">
            {isDone
              ? "00:00"
              : isIdle
                ? formatHiitClock(Math.floor(idlePreviewMs / 1000))
                : countdown}
          </p>
        </HiitCountdownRing>
      </div>

      {!isDone && nextLabel ? (
        <div className={cn("flex shrink-0 flex-col justify-center px-4 py-2.5", theme.next)}>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] opacity-70">Up next</p>
          <div className="mt-0.5 flex items-baseline justify-between gap-3">
            <p className="line-clamp-1 text-base font-black uppercase tracking-tight sm:text-lg">
              {phase?.type === "work" && phase.nextExerciseName
                ? `Rest → ${phase.nextExerciseName}`
                : nextLabel}
            </p>
            {nextPhase && nextPhase.type !== "done" ? (
              <p className="shrink-0 font-mono text-sm font-bold opacity-80">
                {formatHiitClock(nextPhase.durationSeconds)}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 flex-col items-center justify-center bg-emerald-500 px-4 py-2.5 text-black">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em]">Finished</p>
          <p className="text-xl font-black uppercase">Great work</p>
        </div>
      )}

      <div className="flex shrink-0 flex-col gap-2.5 bg-black px-4 pb-[max(0.75rem,var(--safe-area-bottom))] pt-3 text-white">
        <div className="grid grid-cols-3 items-center gap-2">
          <div>
            <p className="font-mono text-2xl font-black text-sky-300">
              {Math.max(0, roundsRemaining)}
            </p>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-white/60">
              Rounds left
            </p>
          </div>
          <div className="flex flex-col items-center">
            {isDone ? (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"
                aria-hidden
              >
                <Check className="h-7 w-7" strokeWidth={2.5} />
              </div>
            ) : isIdle ? (
              <button
                type="button"
                onClick={handleStart}
                disabled={isPending}
                className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-amber-400 bg-amber-400 text-black shadow-[0_0_0_4px_rgba(251,191,36,0.2)]"
                aria-label="Start"
              >
                <Play className="h-6 w-6 fill-current" />
              </button>
            ) : isRunning ? (
              <button
                type="button"
                onClick={handlePause}
                className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-amber-400 bg-amber-400 text-black"
                aria-label="Pause"
              >
                <Pause className="h-6 w-6 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResume}
                className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-amber-400 bg-amber-400 text-black"
                aria-label="Resume"
              >
                <Play className="h-6 w-6 fill-current" />
              </button>
            )}
            <p
              className={cn(
                "mt-1 text-[0.65rem] font-bold uppercase tracking-[0.2em]",
                isDone ? "text-emerald-400" : "text-amber-300"
              )}
            >
              {isDone ? "Done" : isIdle ? "Start" : isRunning ? "Pause" : "Resume"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-black text-amber-300">
              {Math.max(0, cyclesRemaining)}
            </p>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-white/60">
              Cycles left
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 bg-white/10 text-white hover:bg-white/15"
            disabled={isIdle || isDone || isPending}
            onClick={handleSkip}
          >
            <SkipForward className="mr-1.5 h-3.5 w-3.5" />
            Skip
          </Button>
          <p className="text-[0.65rem] text-white/50">
            Round {phase?.round ?? 1}/{phase?.totalRounds ?? 1}
            {phase && phase.totalCycles > 1
              ? ` · Cycle ${phase.cycle}/${phase.totalCycles}`
              : ""}
          </p>
        </div>

        {!isIdle ? (
          <Button
            type="button"
            size="lg"
            className="h-12 w-full shrink-0 gap-2 text-base font-black uppercase tracking-wide"
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
        {(isWarmup || isStretch) ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="h-11 w-full shrink-0 gap-2 bg-white/10 text-sm font-semibold text-white hover:bg-white/15"
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
        {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
      </div>
      {StretchOfferDialog}
      {demoExercise?.name ? (
        <ExerciseDemoDialog
          open={demoOpen}
          onClose={() => setDemoOpen(false)}
          name={demoExercise.name}
          imageUrl={demoExercise.image_url}
          videoUrl={demoExercise.video_url}
          gender={resolveProfileGender(gender)}
        />
      ) : null}
    </div>
  );
}
