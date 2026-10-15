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
  SkipForward,
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
  playHiitComplete,
  playHiitPhaseChange,
  playHiitStart,
  playHiitTick,
  unlockHiitAudio,
} from "@/lib/hiit-sounds";
import {
  advanceHiitPhase,
  catchUpHiitTimer,
  clearHiitTimerState,
  getHiitElapsedMs,
  getHiitTimerState,
  getPhaseRemainingMs,
  hiitConfigHash,
  pauseHiitTimer,
  resumeHiitTimer,
  setHiitTimerState,
  startHiitTimer,
  type HiitTimerState,
} from "@/lib/hiit-timer-storage";
import { formatUserError } from "@/lib/format-user-error";
import { markReminderDone } from "@/lib/reminder-events";
import { useDashboardSync } from "@/components/dashboard-sync";
import { DayFlowProgress } from "@/components/day-flow-progress";
import { ExerciseDemoPlayer } from "@/components/exercise-demo-player";
import { WorkoutTypeBanner } from "@/components/workout-type-banner";
import { resolveProfileGender } from "@/lib/exercise-gif";
import { isPendingWorkoutSessionId } from "@/lib/staged-workout-open";

function mirrorHiitEndsAt(running: boolean, remainingMs: number) {
  if (!running) return 0;
  return (Date.now() + remainingMs) / 1000;
}
import {
  latestWorkoutMirror,
  pushWorkoutMirror,
  subscribeWorkoutMirror,
  suppressWorkoutMirror,
} from "@/lib/watch-session";
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
  SessionStat,
  SessionStatRow,
  SessionTopBar,
} from "@/components/workout-session-ui";

/** Fixed-width digits so a ticking clock cannot paint the old number on top of the new one. */
function HiitBigClock({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center justify-center font-black leading-none tabular-nums",
        "text-[min(22vw,11dvh)]",
        className
      )}
      style={{ fontSynthesis: "none", fontVariantNumeric: "tabular-nums" }}
      aria-live="off"
    >
      {value.split("").map((char, index) => (
        <span
          key={`${index}-${char}`}
          className={cn(
            "inline-flex items-center justify-center overflow-hidden",
            char === ":" ? "w-[0.42em]" : "w-[0.68em]"
          )}
        >
          {char}
        </span>
      ))}
    </p>
  );
}

function useHiitClock(state: HiitTimerState | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state?.status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
      : "Complete";
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
      const durations = phases.map((phase) => phase.durationSeconds * 1000);
      setTimer(
        existing.status === "running"
          ? (catchUpHiitTimer(session.id, durations) ?? existing)
          : existing
      );
    } else if (existing) {
      clearHiitTimerState(session.id);
    }
    setHydrated(true);
  }, [session.id, hash]);

  useEffect(() => {
    const apply = (event: ReturnType<typeof latestWorkoutMirror>) => {
      if (!event) return;
      if (event.action === "cancel" || event.status === "idle") {
        clearHiitTimerState(session.id);
        router.replace("/dashboard");
        return;
      }
      if (event.mode !== "hiit") return;
      const current = getHiitTimerState(session.id);
      if (
        event.action === "hiit" &&
        current &&
        current.phaseIndex === event.hiitIndex &&
        (current.status === "running") === event.hiitRunning
      ) {
        return;
      }
      suppressWorkoutMirror();
      const leftMs =
        event.hiitEndsAt > 0
          ? Math.max(0, event.hiitEndsAt * 1000 - Date.now())
          : Math.max(0, event.hiitLeft * 1000);
      const running = event.hiitRunning;
      const next: HiitTimerState = {
        sessionId: session.id,
        status: running ? "running" : "paused",
        phaseIndex: event.hiitIndex,
        phaseRemainingMs: leftMs,
        segmentStartedAt: running ? Date.now() : null,
        accumulatedElapsedMs: current?.accumulatedElapsedMs ?? 0,
        configHash: hash,
      };
      setHiitTimerState(next);
      setTimer(next);
      if (event.action === "start" && !session.started_at && !isPendingWorkoutSessionId(session.id)) {
        void beginWorkoutSession(session.id);
      }
    };
    const latest = latestWorkoutMirror();
    if (
      latest &&
      latest.mode === "hiit" &&
      latest.status === "live" &&
      Date.now() - latest.receivedAt < 20000
    ) {
      queueMicrotask(() => apply(latest));
    }
    return subscribeWorkoutMirror(apply);
  }, [hash, router, session.id, session.started_at]);

  const publishHiit = (state: HiitTimerState | null, action: string) => {
    const remaining = state ? getPhaseRemainingMs(state) : 0;
    void pushWorkoutMirror({
      status: action === "cancel" ? "idle" : "live",
      action: action === "cancel" ? "cancel" : action === "start" ? "start" : "hiit",
      mode: "hiit",
      sessionId: session.id,
      hiitIndex: state?.phaseIndex ?? 0,
      hiitRunning: state?.status === "running",
      hiitLeft: Math.max(0, Math.ceil(remaining / 1000)),
      hiitEndsAt: mirrorHiitEndsAt(state?.status === "running", remaining),
    });
  };

  const goToPhase = (nextIndex: number, { playSound = true } = {}) => {
    const next = phases[nextIndex];
    lastTickSecondRef.current = null;
    if (!next || next.type === "done") {
      const done = advanceHiitPhase(session.id, nextIndex, 0, true);
      setTimer(done);
      publishHiit(done, "hiit");
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
    publishHiit(advanced, "hiit");
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
    const before = timer.phaseIndex;
    const durations = phases.map((phase) => phase.durationSeconds * 1000);
    const next = catchUpHiitTimer(session.id, durations);
    if (next && (next.phaseIndex !== before || next.status === "completed")) {
      setTimer(next);
      publishHiit(next, "hiit");
      const jump = next.phaseIndex - before;
      if (next.status === "completed") {
        playHiitComplete();
      } else if (jump === 1) {
        const landed = phases[next.phaseIndex];
        if (landed && landed.type !== "done") playHiitPhaseChange(landed.type);
      }
    } else {
      goToPhase(before + 1);
    }
    const unlock = window.setTimeout(() => {
      advancingRef.current = false;
    }, 0);
    return () => {
      window.clearTimeout(unlock);
      advancingRef.current = false;
    };
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

  const handleStart = () => {
    if (busyLockRef.current || isPendingWorkoutSessionId(session.id)) return;
    busyLockRef.current = true;
    setError(null);
    unlockHiitAudio();
    playHiitStart();
    try {
      const first = phases.find((p) => p.type !== "done") ?? phases[0];
      if (!first) return;
      lastTickSecondRef.current = null;
      lastPhaseSoundRef.current = 0;
      const started = startHiitTimer(session.id, first.durationSeconds * 1000, hash);
      setTimer(started);
      publishHiit(started, "start");
      if (!session.started_at) {
        void beginWorkoutSession(session.id).then((result) => {
          if (result && "error" in result && result.error) {
            if (result.error === "Workout is no longer in progress") {
              router.replace("/dashboard");
              return;
            }
            setError(formatUserError(result.error));
          }
        });
      }
    } catch (err) {
      setError(formatUserError(err));
    } finally {
      busyLockRef.current = false;
    }
  };

  const handlePause = () => {
    const next = pauseHiitTimer(session.id);
    setTimer(next);
    publishHiit(next, "hiit");
  };

  const handleResume = () => {
    unlockHiitAudio();
    lastTickSecondRef.current = null;
    const next = resumeHiitTimer(session.id);
    setTimer(next);
    publishHiit(next, "hiit");
  };

  const handleSkip = () => {
    if (!timer || isDone || isBusy) return;
    goToPhase(timer.phaseIndex + 1);
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
      const result = await cancelWorkoutSession(session.id);
      if (result.error) {
        setError(formatUserError(result.error));
        busyLockRef.current = false;
        setBusy("idle");
        return;
      }
      clearHiitTimerState(session.id);
      notifySync();
      publishHiit(null, "cancel");
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
  const bigClock = isDone
    ? "00:00"
    : isIdle
      ? formatHiitClock(Math.floor(idlePreviewMs / 1000))
      : countdown;
  const phaseTone =
    isDone || isIdle
      ? "text-foreground"
      : phase?.type === "work"
        ? "text-primary"
        : phase?.type === "prepare"
          ? "text-amber-400"
          : "text-emerald-400";
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
    <div
      data-native-pull-refresh="off"
      className="fixed inset-0 z-[200] flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground"
    >
      <div className="flex shrink-0 flex-col gap-1.5 px-3 pb-1.5 pt-[max(0.35rem,var(--safe-area-top))]">
        <SessionTopBar
          title={
            isIdle
              ? session.day_title?.trim() ||
                session.plan_title?.trim() ||
                sessionLabel
              : headerTitle
          }
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
          fill
          className="min-h-0 w-full flex-1 [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none"
        >
          <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden bg-black">
            {isIdle ? (
              <WorkoutTypeBanner
                fill
                planTitle={session.plan_title ?? sessionLabel}
                dayTitle={session.day_title ?? session.plan_title ?? sessionLabel}
                planKind={planKind}
                gender={exerciseGender}
                alt={session.day_title || session.plan_title || sessionLabel}
              />
            ) : currentExerciseName ? (
              <div className="absolute inset-0">
                <ExerciseDemoPlayer
                  name={currentExerciseName}
                  imageUrl={currentExercise?.image_url}
                  videoUrl={currentExercise?.video_url}
                  gender={exerciseGender}
                  fill
                  autoplay={Boolean(isRunning && currentExerciseName)}
                  paused={!isRunning}
                  deferMedia={!isRunning}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <p className="text-2xl font-black uppercase tracking-tight text-muted-foreground">
                  {phaseEyebrow}
                </p>
              </div>
            )}
          </div>
        </SessionMediaStage>

        <div className="flex shrink-0 flex-col items-center gap-1 text-center">
          <p
            className={cn(
              "text-xs font-black uppercase tracking-[0.18em]",
              phaseTone
            )}
          >
            {phaseEyebrow}
          </p>
          <HiitBigClock value={bigClock} className={phaseTone} />
          <h2 className="max-w-full text-balance text-xl font-black leading-tight tracking-tight sm:text-2xl">
            {headline}
          </h2>
          {!isDone && nextPhase && nextPhase.type !== "done" ? (
            <p className="text-sm text-muted-foreground [@media(max-height:700px)]:hidden">
              Up next: {nextPhase.exerciseName ?? nextPhase.label} ·{" "}
              {formatHiitClock(nextPhase.durationSeconds)}
            </p>
          ) : null}
        </div>

        <SessionStatRow className="shrink-0 grid-cols-2 border-0 py-1">
          <SessionStat
            value={formatHiitClock(plannedStatSeconds)}
            label={plannedStatLabel}
          />
          <SessionStat
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

      <div className="flex shrink-0 flex-col gap-2 px-4 pb-[max(0.5rem,var(--safe-area-bottom))] pt-2">
        {!isIdle && !isDone ? (
          <>
            <Button
              type="button"
              size="lg"
              className="h-auto min-h-11 w-full gap-2 whitespace-normal rounded-full px-4 py-2.5 text-center text-sm font-black uppercase leading-tight tracking-wide"
              disabled={isBusy}
              onClick={handleComplete}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                  {finishCtaLabel}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="h-11 w-full gap-1.5 rounded-full px-4 text-sm font-semibold"
              disabled={isBusy}
              onClick={handleSkip}
            >
              <SkipForward className="h-4 w-4" />
              {platform.workout.skipExercise}
            </Button>
          </>
        ) : !isIdle ? (
          <Button
            type="button"
            size="lg"
            className="h-auto min-h-11 w-full shrink-0 gap-2 whitespace-normal rounded-full px-4 py-2.5 text-center text-sm font-black uppercase leading-tight tracking-wide"
            disabled={isBusy}
            onClick={handleComplete}
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                {finishCtaLabel}
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
