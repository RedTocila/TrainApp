"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
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
import { markReminderDone } from "@/lib/reminder-events";
import { useDashboardSync } from "@/components/dashboard-sync";
import { DayFlowProgress } from "@/components/day-flow-progress";
import { ExerciseDemoPlayer } from "@/components/exercise-demo-player";
import { resolveProfileGender } from "@/lib/exercise-gif";
import {
  isWarmupPlanKind,
  useDayWorkoutFlowContinue,
} from "@/components/day-workout-flow";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import type { WorkoutSession } from "@/lib/types";
import { cn, formatDateKey } from "@/lib/utils";
import {
  SessionBusyOverlay,
  SessionCircleButton,
  SessionMediaStage,
  SessionSideIconButton,
  SessionStat,
  SessionStatRow,
  SessionTopBar,
} from "@/components/workout-session-ui";

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
  continuesToMain = false,
}: {
  session: WorkoutSession;
  config: HiitConfig;
  planKind?: WorkoutPlanKind;
  gender?: string | null;
  /** Warm-up has a main workout next — finish CTA points into it. */
  continuesToMain?: boolean;
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
  const [busy, setBusy] = useState<
    "idle" | "saving" | "skipping" | "starting" | "leaving"
  >("idle");
  const busyLockRef = useRef(false);
  const advancingRef = useRef(false);
  const lastTickSecondRef = useRef<number | null>(null);
  const lastPhaseSoundRef = useRef<number | null>(null);
  const phases = buildHiitPhases(config);
  const hash = hiitConfigHash(config);
  const { remainingMs, elapsedMs } = useHiitClock(timer);
  const exerciseGender = resolveProfileGender(gender);
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
  const showSkipDayFlow =
    (isWarmup && continuesToMain) || isStretch;
  const finishCtaLabel =
    isWarmup && continuesToMain
      ? platform.workout.finishWarmupNextMain
      : "Complete workout";
  const doneBannerTitle =
    isWarmup && continuesToMain
      ? platform.workout.finishWarmupBannerTitle
      : "Finished";
  const doneBannerBody =
    isWarmup && continuesToMain
      ? platform.workout.finishWarmupBannerBody
      : "Great work";
  const isBusy = busy !== "idle" || isContinuing;
  const busyLabel =
    busy === "skipping"
      ? platform.common.saving
      : busy === "starting"
        ? platform.workout.startWorkout
        : platform.common.saving;

  const phaseIndex = timer?.phaseIndex ?? 0;
  const phase: HiitPhase =
    phases[Math.min(phaseIndex, phases.length - 1)] ?? phases[0];
  const nextPhase =
    phases[phaseIndex + 1] && phases[phaseIndex + 1].type !== "done"
      ? phases[phaseIndex + 1]
      : null;
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

  const handleStart = async () => {
    if (busyLockRef.current) return;
    busyLockRef.current = true;
    setError(null);
    setBusy("starting");
    unlockHiitAudio();
    playHiitStart();
    try {
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
    } catch (err) {
      setError(formatUserError(err));
    } finally {
      busyLockRef.current = false;
      setBusy("idle");
    }
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
    if (!timer || isDone || isBusy) return;
    goToPhase(timer.phaseIndex + 1);
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setHiitSoundsMuted(next);
    if (!next) unlockHiitAudio();
  };

  const handleReset = () => {
    if (isBusy) return;
    resetHiitTimer(session.id);
    lastTickSecondRef.current = null;
    lastPhaseSoundRef.current = null;
    setTimer(null);
  };

  const handleComplete = async () => {
    if (busyLockRef.current) return;
    busyLockRef.current = true;
    setError(null);
    setBusy("saving");
    if (timer?.status === "running") {
      setTimer(pauseHiitTimer(session.id));
    }
    try {
      const result = await completeWorkoutSession(session.id);
      if (result && "error" in result && result.error) {
        setError(formatUserError(result.error));
        busyLockRef.current = false;
        setBusy("idle");
        return;
      }
      clearHiitTimerState(session.id);
      const dateKey =
        ("scheduledDate" in result && result.scheduledDate) ||
        session.scheduled_date ||
        formatDateKey(new Date());
      markReminderDone("workout");
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
      // Stay busy until route unmounts for continue/home; unlock for stretch offer.
      if (flow === "stretch_offer") {
        busyLockRef.current = false;
        setBusy("idle");
      }
    } catch (err) {
      setError(formatUserError(err));
      busyLockRef.current = false;
      setBusy("idle");
    }
  };

  const handleSkipToMain = async () => {
    if (busyLockRef.current) return;
    busyLockRef.current = true;
    setError(null);
    setBusy("skipping");
    try {
      const result = await skipDayFlowSession(session.id);
      if (result && "error" in result && result.error) {
        setError(formatUserError(result.error));
        busyLockRef.current = false;
        setBusy("idle");
        return;
      }
      clearHiitTimerState(session.id);
      notifySync();
      if (result && "sessionId" in result && result.sessionId) {
        router.replace(`/dashboard/workout/session/${result.sessionId}`);
        return;
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(formatUserError(err));
      busyLockRef.current = false;
      setBusy("idle");
    }
  };

  const handleCancel = async () => {
    if (busyLockRef.current) return;
    busyLockRef.current = true;
    setError(null);
    setBusy("leaving");
    try {
      await cancelWorkoutSession(session.id);
      clearHiitTimerState(session.id);
      notifySync();
      router.replace("/dashboard");
    } catch (err) {
      setError(formatUserError(err));
      busyLockRef.current = false;
      setBusy("idle");
    }
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
  const idlePreviewMs = (phases[0]?.durationSeconds ?? 0) * 1000;
  const phaseEyebrow =
    phase?.type === "prepare"
      ? platform.workout.getReadyFor
      : phase?.type === "work"
        ? platform.workout.work
        : phase?.label;
  const headline =
    phase?.type === "work"
      ? phase.exerciseName ?? platform.workout.work
      : phase?.type === "prepare"
        ? phase.exerciseName ?? phase?.label ?? platform.workout.getReadyFor
        : phase?.label ?? "HIIT";

  const currentExerciseName =
    phase?.type === "work" || phase?.type === "prepare"
      ? phase.exerciseName
      : phase?.nextExerciseName ?? nextPhase?.exerciseName ?? null;
  const currentExercise = currentExerciseName
    ? (config.exercises.find((ex) => ex.name === currentExerciseName) ?? null)
    : null;

  const workSeconds =
    currentExercise?.work_seconds ??
    (phase?.type === "work"
      ? phase.durationSeconds
      : config.exercises[0]?.work_seconds ?? 40);
  const restSeconds =
    currentExercise?.rest_seconds ??
    (phase?.type === "rest"
      ? phase.durationSeconds
      : config.exercises[0]?.rest_seconds ?? 20);
  const isRestPhase =
    phase?.type === "rest" ||
    phase?.type === "round_rest" ||
    phase?.type === "cycle_rest";
  const plannedStatSeconds = isRestPhase ? restSeconds : workSeconds;
  const plannedStatLabel = isRestPhase
    ? platform.workout.rest
    : platform.workout.work;

  const playLabel = isDone
    ? "Done"
    : isIdle
      ? platform.workout.startWorkout
      : isRunning
        ? "Pause"
        : "Resume";

  const headerTitle = `${sessionLabel} · ${totalElapsed}${
    cyclesRemaining > 0
      ? ` · ${cyclesRemaining} ${platform.workout.cyclesLeft}`
      : ""
  }`;

  return (
    <div className="fixed inset-0 z-[200] flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 flex-col gap-1.5 px-3 pb-1.5 pt-[max(0.35rem,var(--safe-area-top))]">
        <SessionTopBar
          title={headerTitle}
          onBack={handleCancel}
          backDisabled={isBusy}
          trailing={
            isDone ? (
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/15 text-emerald-400"
                aria-hidden
              >
                <Check className="h-5 w-5" strokeWidth={2.5} />
              </div>
            ) : (
              <SessionCircleButton
                label={playLabel}
                onClick={isIdle ? handleStart : isRunning ? handlePause : handleResume}
                disabled={isIdle && isBusy}
                busy={busy === "starting"}
              >
                {isRunning ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="h-5 w-5 fill-current" />
                )}
              </SessionCircleButton>
            )
          }
        />

        {showDayFlow ? (
          <DayFlowProgress currentKind={planKind} compact className="px-0.5" />
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 pb-1">
        <SessionMediaStage
          className="min-h-0 flex-1"
          fill
          sideActions={
            <>
              <SessionSideIconButton
                label={muted ? "Unmute sounds" : "Mute sounds"}
                onClick={handleToggleMute}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </SessionSideIconButton>
              <SessionSideIconButton
                label="Reset"
                onClick={handleReset}
                disabled={isIdle || isBusy}
              >
                <RotateCcw className="h-4 w-4" />
              </SessionSideIconButton>
            </>
          }
        >
          <div className="relative h-full min-h-0 w-full overflow-hidden bg-black">
            {currentExerciseName ? (
              <div className="absolute inset-0">
                <ExerciseDemoPlayer
                  name={currentExerciseName}
                  imageUrl={currentExercise?.image_url}
                  videoUrl={currentExercise?.video_url}
                  gender={exerciseGender}
                  fill
                  autoplay={Boolean(isRunning && currentExerciseName)}
                  paused={!isRunning}
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {phaseEyebrow}
                </p>
                <p
                  className={cn(
                    "font-mono text-5xl font-black tabular-nums tracking-tighter",
                    isRunning && isRestPhase && "animate-pulse text-primary"
                  )}
                >
                  {isDone
                    ? "00:00"
                    : isIdle
                      ? formatHiitClock(Math.floor(idlePreviewMs / 1000))
                      : countdown}
                </p>
              </div>
            )}
          </div>
        </SessionMediaStage>

        <div className="shrink-0 space-y-0.5 text-center">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {phaseEyebrow}
          </p>
          <h2 className="text-lg font-black leading-tight tracking-tight sm:text-xl">
            {headline}
          </h2>
          {!isDone && nextPhase && nextPhase.type !== "done" ? (
            <p className="text-xs text-muted-foreground sm:text-sm">
              Up next: {nextPhase.exerciseName ?? nextPhase.label} ·{" "}
              {formatHiitClock(nextPhase.durationSeconds)}
            </p>
          ) : null}
        </div>

        <SessionStatRow className="shrink-0 py-2.5">
          <SessionStat
            compact
            value={formatHiitClock(plannedStatSeconds)}
            label={plannedStatLabel}
          />
          <SessionStat
            compact
            value={
              isDone
                ? "00:00"
                : isIdle
                  ? formatHiitClock(Math.floor(idlePreviewMs / 1000))
                  : countdown
            }
            label={
              phase?.type === "work"
                ? platform.workout.work
                : isRestPhase
                  ? platform.workout.rest
                  : phaseEyebrow ?? platform.workout.rest
            }
            emphasize
            pulse={isRunning && isRestPhase}
          />
          <SessionStat
            compact
            value={`${Math.max(0, roundsRemaining)}`}
            label={platform.workout.roundsLeft}
          />
        </SessionStatRow>

        {isDone ? (
          <div className="shrink-0 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-emerald-400">
              {doneBannerTitle}
            </p>
            <p className="text-base font-black uppercase text-foreground">
              {doneBannerBody}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-border/50 px-4 pb-[max(0.5rem,var(--safe-area-bottom))] pt-2.5">
        {!isIdle && !isDone ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="h-11 shrink-0 gap-1.5 rounded-full px-4 text-sm font-semibold"
              disabled={isBusy}
              onClick={handleSkip}
            >
              <SkipForward className="h-4 w-4" />
              {platform.workout.skipExercise}
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-11 min-w-0 flex-1 gap-2 rounded-full text-sm font-black uppercase tracking-wide"
              disabled={isBusy}
              onClick={handleComplete}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                  <span className="truncate">{finishCtaLabel}</span>
                </>
              )}
            </Button>
          </div>
        ) : !isIdle ? (
          <Button
            type="button"
            size="lg"
            className="h-11 w-full shrink-0 gap-2 rounded-full text-sm font-black uppercase tracking-wide"
            disabled={isBusy}
            onClick={handleComplete}
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                <span className="truncate">{finishCtaLabel}</span>
              </>
            )}
          </Button>
        ) : null}
        {showSkipDayFlow ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="h-10 w-full shrink-0 gap-2 rounded-full text-sm font-semibold"
            disabled={isBusy}
            onClick={handleSkipToMain}
          >
            {busy === "skipping" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <SkipForward className="h-4 w-4" />
                {skipLabel}
              </>
            )}
          </Button>
        ) : null}
        {error ? (
          <p className={cn("text-center text-sm text-destructive")}>{error}</p>
        ) : null}
      </div>
      {isBusy ? <SessionBusyOverlay label={busyLabel} /> : null}
      {StretchOfferDialog}
    </div>
  );
}
