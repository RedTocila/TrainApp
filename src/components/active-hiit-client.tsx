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
} from "@/lib/actions/workout-sessions";
import {
  buildHiitPhases,
  formatHiitClock,
  type HiitConfig,
  type HiitPhase,
  type HiitPhaseType,
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
import { Button } from "@/components/ui/button";
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
}: {
  session: WorkoutSession;
  config: HiitConfig;
}) {
  const router = useRouter();
  const { notifySync, patchDashboard } = useDashboardSync();
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
      : phase?.label ?? "HIIT";
  const nextLabel =
    phase?.nextExerciseName ??
    nextPhase?.exerciseName ??
    (nextPhase?.type === "round_rest"
      ? "Round rest"
      : nextPhase?.type === "cycle_rest"
        ? "Cycle rest"
        : nextPhase?.label);

  return (
    <div className="fixed inset-0 z-[110] flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 px-3 pb-1 pt-[max(0.5rem,var(--safe-area-top))]">
        <Link
          href="/dashboard"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary/80 text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <p className="flex items-center justify-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">
            <Zap className="h-3 w-3" />
            HIIT
          </p>
          <p className="font-mono text-xs text-muted-foreground">{totalElapsed}</p>
        </div>
        <div className="flex gap-0.5">
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
      </header>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 px-4 py-2 transition-colors",
          theme.panel
        )}
      >
        <p className={cn("text-center text-[0.65rem] font-bold uppercase tracking-[0.25em]", theme.accent)}>
          {phase?.type === "work" ? "Work" : phase?.label}
        </p>
        <h1 className="line-clamp-2 max-w-full text-center text-lg font-black uppercase leading-tight tracking-tight sm:text-xl">
          {headline}
        </h1>
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
              <Button
                size="lg"
                className="h-14 w-14 rounded-full bg-primary text-primary-foreground"
                disabled={isPending}
                onClick={handleComplete}
                aria-label="Complete workout"
              >
                <Check className="h-6 w-6" />
              </Button>
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
            <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-300">
              {isDone ? "Complete" : isIdle ? "Start" : isRunning ? "Pause" : "Resume"}
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
            className="h-11 w-full shrink-0"
            disabled={isPending}
            onClick={handleComplete}
          >
            <Check className="mr-2 h-4 w-4" />
            {isPending ? "Saving…" : "Complete workout"}
          </Button>
        ) : null}
        {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
