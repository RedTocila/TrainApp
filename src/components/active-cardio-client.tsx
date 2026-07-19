"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCardioTypeDisplay, localizeCardioTitle } from "@/lib/cardio-catalog";
import {
  formatCardioElapsedMinutes,
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
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">
              {isStarted ? platform.cardio.stillGoing : platform.cardio.readyToStart}
            </p>
            <h1 className="text-2xl font-black">
              {cardioDisplayTitle ?? platform.cardio.title}
            </h1>
            {cardio?.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{cardio.description}</p>
            ) : null}
          </div>
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
      </div>

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
            iconBg
          )}
        >
          <Icon className={cn("h-7 w-7", iconAccent)} />
        </div>
        {plannedMinutes != null ? (
          <Badge variant="secondary">{platform.common.min(plannedMinutes)}</Badge>
        ) : null}
      </div>

      {hydrated ? (
        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/10 p-2">
                <Clock className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums tracking-tight">
                  {formatElapsedClock(elapsedSeconds)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isRunning
                    ? platform.cardio.elapsed
                    : timer?.status === "paused"
                      ? platform.cardio.pause
                      : platform.cardio.readyToStart}
                </p>
              </div>
            </div>
            {plannedSeconds != null ? (
              <div className="text-right">
                <p className="text-sm font-medium">
                  {platform.cardio.planned}: {platform.common.min(plannedMinutes!)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {elapsedSeconds >= plannedSeconds
                    ? `+${formatElapsedClock(elapsedSeconds - plannedSeconds)}`
                    : formatElapsedClock(plannedSeconds - elapsedSeconds)}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {cardio?.youtube_url ? (
        <ExerciseVideoPlayer
          videoUrl={cardio.youtube_url}
          title={cardioDisplayTitle ?? cardio.title}
        />
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="space-y-3 border-t border-border pt-6">
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
            ) : null}

            <Card className="border-border/60 bg-background/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {platform.cardio.finishSummaryTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">{platform.cardio.youDid}</p>
                  <p className="font-medium tabular-nums">
                    {formatElapsedClock(elapsedSeconds)}
                    <span className="ml-1 text-muted-foreground">
                      ({platform.common.min(formatCardioElapsedMinutes(elapsedSeconds))})
                    </span>
                  </p>
                </div>
                {plannedMinutes != null ? (
                  <div>
                    <p className="text-muted-foreground">{platform.cardio.planned}</p>
                    <p className="font-medium">{platform.common.min(plannedMinutes)}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Button
              variant="ghost"
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
