"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Square,
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
import { cn } from "@/lib/utils";

function phaseTheme(type: HiitPhaseType) {
  switch (type) {
    case "work":
      return {
        panel: "bg-primary text-primary-foreground",
        next: "bg-emerald-500 text-black",
        accent: "text-primary-foreground/80",
        ring: "border-primary-foreground/40",
        control: "bg-black text-primary-foreground",
      };
    case "rest":
      return {
        panel: "bg-emerald-500 text-black",
        next: "bg-primary text-primary-foreground",
        accent: "text-black/70",
        ring: "border-black/30",
        control: "bg-black text-emerald-400",
      };
    case "round_rest":
    case "cycle_rest":
      return {
        panel: "bg-sky-500 text-black",
        next: "bg-primary text-primary-foreground",
        accent: "text-black/70",
        ring: "border-black/30",
        control: "bg-black text-sky-300",
      };
    case "prepare":
      return {
        panel: "bg-amber-400 text-black",
        next: "bg-primary text-primary-foreground",
        accent: "text-black/70",
        ring: "border-black/25",
        control: "bg-black text-amber-300",
      };
    default:
      return {
        panel: "bg-background text-foreground",
        next: "bg-secondary text-foreground",
        accent: "text-muted-foreground",
        ring: "border-border",
        control: "bg-secondary text-foreground",
      };
  }
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
  const { notifySync } = useDashboardSync();
  const [timer, setTimer] = useState<HiitTimerState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const advancingRef = useRef(false);
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
    setHydrated(true);
  }, [session.id, hash]);

  const goToPhase = (nextIndex: number) => {
    const next = phases[nextIndex];
    if (!next || next.type === "done") {
      const done = advanceHiitPhase(session.id, nextIndex, 0, true);
      setTimer(done);
      return;
    }
    const advanced = advanceHiitPhase(
      session.id,
      nextIndex,
      next.durationSeconds * 1000,
      false
    );
    setTimer(advanced);
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

  const handleStart = () => {
    setError(null);
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
      setTimer(startHiitTimer(session.id, first.durationSeconds * 1000, hash));
    });
  };

  const handlePause = () => {
    setTimer(pauseHiitTimer(session.id));
  };

  const handleResume = () => {
    setTimer(resumeHiitTimer(session.id));
  };

  const handleSkip = () => {
    if (!timer || isDone) return;
    goToPhase(timer.phaseIndex + 1);
  };

  const handleReset = () => {
    resetHiitTimer(session.id);
    setTimer(null);
  };

  const handleComplete = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeWorkoutSession(session.id);
      if (result && "error" in result && result.error) {
        setError(formatUserError(result.error));
        return;
      }
      clearHiitTimerState(session.id);
      notifySync();
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
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,var(--safe-area-top))]">
        <Link
          href="/dashboard"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary/80 text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <p className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-orange-400">
            <Zap className="h-3.5 w-3.5" />
            HIIT
          </p>
          <p className="font-mono text-sm text-muted-foreground">{totalElapsed}</p>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
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
            onClick={handleCancel}
            disabled={isPending}
            aria-label="Exit"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className={cn("flex flex-[1.35] flex-col justify-center px-6 py-6 transition-colors", theme.panel)}>
        <p className={cn("text-center text-sm font-bold uppercase tracking-[0.25em]", theme.accent)}>
          {phase?.type === "work" ? "Work" : phase?.label}
        </p>
        <h1 className="mt-2 text-center text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
          {headline}
        </h1>
        <p className="mt-6 text-center font-mono text-[4.75rem] font-black leading-none tracking-tighter sm:text-[6rem]">
          {isDone ? "00:00" : isIdle ? formatHiitClock(phases[0]?.durationSeconds ?? 0) : countdown}
        </p>
        {session.plan_title ? (
          <p className={cn("mt-4 text-center text-sm font-medium", theme.accent)}>
            {session.plan_title}
          </p>
        ) : null}
      </div>

      {!isDone && nextLabel ? (
        <div className={cn("flex flex-[0.55] flex-col justify-center px-6 py-4", theme.next)}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">Up next</p>
          <p className="mt-1 text-2xl font-black uppercase tracking-tight">
            {phase?.type === "work" && phase.nextExerciseName
              ? `Rest → ${phase.nextExerciseName}`
              : nextLabel}
          </p>
          {nextPhase && nextPhase.type !== "done" ? (
            <p className="mt-1 font-mono text-lg font-bold opacity-80">
              {formatHiitClock(nextPhase.durationSeconds)}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-[0.55] flex-col items-center justify-center bg-emerald-500 px-6 py-4 text-black">
          <p className="text-xs font-bold uppercase tracking-[0.2em]">Finished</p>
          <p className="mt-1 text-3xl font-black uppercase">Great work</p>
        </div>
      )}

      <div className="flex flex-[0.7] flex-col justify-between bg-black px-6 pb-[max(1.25rem,var(--safe-area-bottom))] pt-5 text-white">
        <div className="grid grid-cols-3 items-center gap-3">
          <div>
            <p className="font-mono text-3xl font-black text-sky-300">
              {Math.max(0, roundsRemaining)}
            </p>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/60">
              Rounds left
            </p>
          </div>
          <div className="flex flex-col items-center">
            {isDone ? (
              <Button
                size="lg"
                className="h-16 w-16 rounded-full bg-primary text-primary-foreground"
                disabled={isPending}
                onClick={handleComplete}
              >
                <Play className="h-6 w-6 fill-current" />
              </Button>
            ) : isIdle ? (
              <button
                type="button"
                onClick={handleStart}
                disabled={isPending}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-amber-400 bg-amber-400 text-black shadow-[0_0_0_6px_rgba(251,191,36,0.2)]"
                aria-label="Start"
              >
                <Play className="h-7 w-7 fill-current" />
              </button>
            ) : isRunning ? (
              <button
                type="button"
                onClick={handlePause}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-amber-400 bg-amber-400 text-black"
                aria-label="Pause"
              >
                <Pause className="h-7 w-7 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResume}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-amber-400 bg-amber-400 text-black"
                aria-label="Resume"
              >
                <Play className="h-7 w-7 fill-current" />
              </button>
            )}
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
              {isDone ? "Finish" : isIdle ? "Start" : isRunning ? "Pause" : "Resume"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-3xl font-black text-amber-300">
              {Math.max(0, cyclesRemaining)}
            </p>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/60">
              Cycles left
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="bg-white/10 text-white hover:bg-white/15"
            disabled={isIdle || isDone || isPending}
            onClick={handleSkip}
          >
            <SkipForward className="mr-1.5 h-4 w-4" />
            Skip
          </Button>
          {isDone ? (
            <Button size="sm" disabled={isPending} onClick={handleComplete}>
              {isPending ? "Saving…" : "Complete workout"}
            </Button>
          ) : (
            <p className="text-xs text-white/50">
              Round {phase?.round ?? 1}/{phase?.totalRounds ?? 1}
              {phase && phase.totalCycles > 1
                ? ` · Cycle ${phase.cycle}/${phase.totalCycles}`
                : ""}
            </p>
          )}
        </div>
        {error ? <p className="mt-2 text-center text-sm text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
