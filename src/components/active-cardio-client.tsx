"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowLeft,
  Check,
  HeartPulse,
  Loader2,
  Pause,
  Play,
  Square,
} from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { useDashboardSync } from "@/components/dashboard-sync";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { StartWorkoutLoadingShell } from "@/components/start-workout-loading-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCardioTypeDisplay, localizeCardioTitle } from "@/lib/cardio-catalog";
import {
  isCardioDurationComplete,
  minCardioSecondsForComplete,
} from "@/lib/cardio-completion";
import {
  clearCardioTimerState,
  getCardioElapsedMs,
  getCardioTimerState,
  pauseCardioTimer,
  resumeCardioTimer,
  startCardioTimer,
  type CardioTimerState,
} from "@/lib/cardio-timer-storage";
import { completeScheduleTask } from "@/lib/actions/task-completions";
import { cardioTaskId } from "@/lib/cardio-task-id";
import {
  dashboardDayCacheKey,
  getDashboardDayCache,
  setDashboardDayCache,
} from "@/lib/dashboard-day-cache";
import { formatUserError } from "@/lib/format-user-error";
import { markReminderDone } from "@/lib/reminder-events";
import { formatElapsedClock } from "@/lib/workout-duration";
import type { ScheduledCardio } from "@/lib/types";
import { cn } from "@/lib/utils";

function useElapsedMs(state: CardioTimerState | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state?.status !== "running") return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [state?.status]);

  return getCardioElapsedMs(state, now);
}

export function ActiveCardioClient({
  clientId,
  dateKey,
  scheduled,
  initiallyCompleted,
}: {
  clientId: string;
  dateKey: string;
  scheduled: ScheduledCardio;
  initiallyCompleted: boolean;
}) {
  const platform = usePlatformCopy();
  const router = useRouter();
  const { patchDashboard, notifySync } = useDashboardSync();
  const [timer, setTimer] = useState<CardioTimerState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const elapsedMs = useElapsedMs(timer);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  const cardio = scheduled.client_cardio;
  const plannedMinutes = cardio?.duration_minutes ?? null;
  const plannedSeconds = plannedMinutes != null ? plannedMinutes * 60 : null;
  const minSeconds = minCardioSecondsForComplete(plannedMinutes);
  const canComplete = isCardioDurationComplete(elapsedSeconds, plannedMinutes);
  const display = cardio
    ? getCardioTypeDisplay(cardio.title, platform.cardio.types)
    : null;
  const cardioDisplayTitle = cardio
    ? localizeCardioTitle(cardio.title, platform.cardio.types)
    : null;
  const Icon = display?.icon ?? HeartPulse;
  const iconAccent = display?.accentClass ?? "text-orange-400";
  const iconBg = display?.bgClass ?? "bg-orange-500/15";
  const isStarted = timer?.status === "running" || timer?.status === "paused";
  const isRunning = timer?.status === "running";
  const cardioId = scheduled.cardio_id ?? cardio?.id ?? null;
  const taskId = cardioTaskId(dateKey, cardioId);

  useEffect(() => {
    setTimer(getCardioTimerState(dateKey, cardioId));
    setHydrated(true);
  }, [dateKey, cardioId]);

  const handleStart = () => {
    setError(null);
    setTimer(startCardioTimer(dateKey, cardioId));
  };

  const handlePause = () => {
    setTimer(pauseCardioTimer(dateKey, cardioId));
  };

  const handleResume = () => {
    setTimer(resumeCardioTimer(dateKey, cardioId));
  };

  const handleDiscard = () => {
    clearCardioTimerState(dateKey, cardioId);
    setTimer(null);
    router.push("/dashboard");
  };

  const handleFinish = () => {
    setError(null);
    if (!canComplete) {
      if (minSeconds != null) {
        const remaining = Math.max(0, minSeconds - elapsedSeconds);
        setError(platform.cardio.needMoreTime(formatElapsedClock(remaining)));
      } else {
        setError(platform.cardio.tooShortToComplete);
      }
      return;
    }

    startTransition(async () => {
      const result = await completeScheduleTask(clientId, dateKey, taskId, {
        elapsedSeconds,
        plannedMinutes,
      });
      if (result.error) {
        setError(formatUserError(result.error));
        return;
      }

      markReminderDone("cardio");

      const cacheKey = dashboardDayCacheKey(clientId, "cardio", dateKey);
      const cached = getDashboardDayCache<{
        scheduled: ScheduledCardio[];
        completions: Record<
          string,
          { completed: boolean; elapsedSeconds: number | null }
        >;
      }>(cacheKey);
      const nextCompletions = {
        ...(cached?.completions ?? {}),
        ...(cardioId
          ? {
              [cardioId]: {
                completed: true,
                elapsedSeconds,
              },
            }
          : {}),
      };
      setDashboardDayCache(cacheKey, {
        scheduled: cached?.scheduled?.length
          ? cached.scheduled
          : [scheduled],
        completions: nextCompletions,
      });

      patchDashboard({ dateKey, taskId, completed: true });
      clearCardioTimerState(dateKey, cardioId);
      notifySync();
      router.push("/dashboard");
    });
  };

  if (initiallyCompleted && !isStarted) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pb-8">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {platform.common.back}
          </Button>
        </Link>
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <p className="font-medium">{platform.cardio.alreadyCompleted}</p>
            <Link href="/dashboard">
              <Button>{platform.common.back}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-2rem)] max-w-2xl flex-col gap-3 overflow-hidden pb-[max(0.5rem,var(--safe-area-bottom))]">
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="-ml-2 h-9 w-fit px-2">
              <ArrowLeft className="mr-1 h-4 w-4" />
              {platform.common.back}
            </Button>
          </Link>
          {isStarted ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 shrink-0 rounded-full px-3 text-xs font-semibold"
              disabled={isPending}
              onClick={handleDiscard}
              aria-label={platform.cardio.discardSession}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              {platform.workout.stop}
            </Button>
          ) : null}
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              iconBg
            )}
          >
            <Icon className={cn("h-5 w-5", iconAccent)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-400">
              {isStarted ? platform.cardio.stillGoing : platform.cardio.readyToStart}
            </p>
            <h1 className="truncate text-xl font-black leading-tight">
              {cardioDisplayTitle ?? platform.cardio.title}
            </h1>
          </div>
          {plannedMinutes != null ? (
            <Badge variant="secondary" className="shrink-0">
              {platform.common.min(plannedMinutes)}
            </Badge>
          ) : null}
        </div>
      </div>

      {hydrated ? (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-orange-500/25 bg-gradient-to-b from-orange-500/15 via-orange-500/[0.06] to-transparent">
          <CardContent className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-4">
            <div
              className={cn(
                "relative flex aspect-square w-[min(100%,13.5rem)] max-h-[min(42vh,15rem)] items-center justify-center rounded-full border-2 sm:w-[min(100%,15rem)]",
                isRunning
                  ? "border-orange-400/50 shadow-[0_0_40px_-8px_rgba(251,146,60,0.45)]"
                  : "border-orange-500/30"
              )}
            >
              {plannedSeconds != null ? (
                <svg
                  className="absolute inset-0 -rotate-90"
                  viewBox="0 0 100 100"
                  aria-hidden
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    className="stroke-orange-500/15"
                    strokeWidth="3.5"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    className="stroke-orange-400 transition-[stroke-dashoffset] duration-300"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 46}`}
                    strokeDashoffset={`${
                      2 *
                      Math.PI *
                      46 *
                      (1 - Math.min(1, elapsedSeconds / plannedSeconds))
                    }`}
                  />
                </svg>
              ) : (
                <div
                  aria-hidden
                  className="absolute inset-2 rounded-full border border-dashed border-orange-500/20"
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-1 px-3 text-center">
                <p className="font-mono text-4xl font-black tabular-nums tracking-tighter sm:text-5xl">
                  {formatElapsedClock(elapsedSeconds)}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {isRunning
                    ? platform.cardio.elapsed
                    : timer?.status === "paused"
                      ? platform.cardio.pause
                      : platform.cardio.readyToStart}
                </p>
              </div>
            </div>

            {plannedSeconds != null ? (
              <div className="grid w-full max-w-sm shrink-0 grid-cols-2 gap-2 text-center">
                <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {platform.cardio.planned}
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums">
                    {formatElapsedClock(plannedSeconds)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {elapsedSeconds >= plannedSeconds
                      ? platform.cardio.overtime
                      : platform.cardio.remaining}
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-orange-300">
                    {elapsedSeconds >= plannedSeconds
                      ? `+${formatElapsedClock(elapsedSeconds - plannedSeconds)}`
                      : formatElapsedClock(plannedSeconds - elapsedSeconds)}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card className="flex min-h-0 flex-1 border-dashed">
          <CardContent className="flex flex-1 items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {cardio?.youtube_url ? (
        <div className="max-h-36 shrink-0 overflow-hidden">
          <ExerciseVideoPlayer
            videoUrl={cardio.youtube_url}
            title={cardioDisplayTitle ?? cardio.title}
          />
        </div>
      ) : null}

      {error ? (
        <p className="shrink-0 text-sm text-red-400">{error}</p>
      ) : null}

      <div className="shrink-0 space-y-2">
        {!isStarted ? (
          <StartWorkoutLoadingShell isLoading={false} className="w-full">
            <Button size="lg" className="w-full" onClick={handleStart}>
              <Play className="mr-2 h-4 w-4" />
              {platform.cardio.startSession}
            </Button>
          </StartWorkoutLoadingShell>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {isRunning ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={handlePause}
                  disabled={isPending}
                >
                  <Pause className="h-4 w-4" />
                  {platform.cardio.pause}
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={handleResume}
                  disabled={isPending}
                >
                  <Play className="h-4 w-4" />
                  {platform.cardio.resume}
                </Button>
              )}
              <Button
                size="lg"
                className="w-full"
                onClick={handleFinish}
                disabled={isPending || !canComplete}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {isPending ? platform.cardio.finishing : platform.cardio.finish}
              </Button>
            </div>

            {!canComplete && minSeconds != null ? (
              <p className="text-center text-xs text-muted-foreground">
                {platform.cardio.needMoreTime(
                  formatElapsedClock(Math.max(0, minSeconds - elapsedSeconds))
                )}
              </p>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                {platform.cardio.youDid}{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatElapsedClock(elapsedSeconds)}
                </span>
                {plannedMinutes != null ? (
                  <>
                    {" · "}
                    {platform.cardio.planned}{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      {platform.common.min(plannedMinutes)}
                    </span>
                  </>
                ) : null}
              </p>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              disabled={isPending}
              onClick={handleDiscard}
            >
              {platform.cardio.discardSession}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
