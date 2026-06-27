"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { format, isToday, isTomorrow } from "date-fns";
import { HeartPulse } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardDateFetch } from "@/components/dashboard-date-loading";
import { useDashboardSync } from "@/components/dashboard-sync";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { DashboardStatusIcon } from "@/components/section-completed-badge";
import { dashboard, DashboardEmptyState } from "@/components/dashboard-ui";
import { getCardioTypeDisplay } from "@/lib/cardio-catalog";
import { getScheduledCardioForDate } from "@/lib/actions/user-cardio";
import { getTaskCompletionsForDate, toggleScheduleTaskCompletion } from "@/lib/actions/task-completions";
import type { ScheduledCardio } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function cardioTitle(date: Date, platform: ReturnType<typeof usePlatformCopy>) {
  if (isToday(date)) return platform.dashboard.todaysCardio;
  if (isTomorrow(date)) return platform.dashboard.tomorrowsCardio;
  return platform.dashboard.cardioOnDay(format(date, "EEEE"));
}

export function DashboardCardioCard({
  clientId,
  initialScheduled = null,
  initialCompleted = false,
  variant = "compact",
}: {
  clientId: string;
  initialScheduled?: ScheduledCardio | null;
  initialCompleted?: boolean;
  variant?: "full" | "compact";
}) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const { selectedDate, todayKey } = useSelectedDate();
  const { version, patchDashboard } = useDashboardSync();
  const [scheduled, setScheduled] = useState<ScheduledCardio | null>(
    initialScheduled
  );
  const [completed, setCompleted] = useState(initialCompleted);
  const [isToggling, setIsToggling] = useState(false);
  const dateKey = formatDateKey(selectedDate);
  const taskId = `${dateKey}-cardio`;
  const cardio = scheduled?.client_cardio ?? null;
  const compact = variant === "compact";

  useEffect(() => {
    setScheduled(initialScheduled);
    setCompleted(initialCompleted);
  }, [initialScheduled, initialCompleted]);

  const refreshCardio = useCallback(async () => {
    const [entry, ids] = await Promise.all([
      getScheduledCardioForDate(clientId, dateKey),
      getTaskCompletionsForDate(clientId, dateKey),
    ]);
    setScheduled(entry);
    setCompleted(ids.has(taskId));
  }, [clientId, dateKey, taskId]);

  const isReady = useDashboardDateFetch(dateKey, refreshCardio, [
    clientId,
    taskId,
    version,
    todayKey,
  ]);

  const cardioForDay = isReady ? cardio : null;
  const completedForDay = isReady && completed;
  const cardioDisplay = cardioForDay
    ? getCardioTypeDisplay(cardioForDay.title, platform.cardio.types)
    : null;
  const CardioTypeIcon = cardioDisplay?.icon ?? HeartPulse;
  const cardioIconAccent = cardioDisplay?.accentClass ?? "text-orange-400";
  const cardioIconBg = cardioDisplay?.bgClass ?? "bg-orange-500/15";

  const handleToggle = () => {
    const next = !completed;
    setCompleted(next);
    patchDashboard({ dateKey, taskId, completed: next });
    setIsToggling(true);

    void toggleScheduleTaskCompletion(clientId, dateKey, taskId)
      .then((result) => {
        if (result.error) {
          setCompleted(!next);
          patchDashboard({ dateKey, taskId, completed: !next });
          return;
        }
        setCompleted(result.completed ?? false);
      })
      .finally(() => setIsToggling(false));
  };

  if (compact) {
    return (
      <div id="dashboard-cardio" className={cn(dashboard.tile, dashboard.pairTile)}>
        {completedForDay && cardioForDay ? (
          <div className="absolute right-2 top-2 z-10 sm:right-3 sm:top-3">
            <DashboardStatusIcon status="completed" aria-label={platform.aria.completed} />
          </div>
        ) : null}
        <div className="flex items-center gap-2 pr-8">
          <HeartPulse className="h-5 w-5 shrink-0 text-orange-400" />
          <p className="truncate text-sm font-black">{platform.cardio.title}</p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-2">
          {isReady && cardioForDay ? (
            <>
              <div
                className={cn(
                  "flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl sm:h-20 sm:w-20",
                  cardioIconBg
                )}
              >
                <CardioTypeIcon className={cn("h-9 w-9 sm:h-10 sm:w-10", cardioIconAccent)} />
              </div>
              <p
                className={cn(
                  "line-clamp-2 max-w-full px-1 text-center text-sm font-semibold leading-snug",
                  completedForDay && "text-muted-foreground line-through"
                )}
              >
                {cardioForDay.title}
              </p>
              {cardioForDay.duration_minutes != null && (
                <Badge variant="secondary" className="text-[10px]">
                  {platform.common.min(cardioForDay.duration_minutes)}
                </Badge>
              )}
            </>
          ) : isReady ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-secondary/40 sm:h-20 sm:w-20">
                <HeartPulse className="h-9 w-9 text-muted-foreground/50 sm:h-10 sm:w-10" />
              </div>
              <p className="text-xs text-muted-foreground">{coachLabels.noCardioToday}</p>
            </div>
          ) : null}
        </div>
        <div className="mt-auto flex gap-1.5 pt-2">
          <Link href="/dashboard/workout/cardio" className="flex-1">
            <Button size="sm" variant="outline" className="h-8 w-full rounded-full px-2 text-[11px]">
              {platform.cardio.myCardio}
            </Button>
          </Link>
          {cardioForDay && !completedForDay ? (
            <Button
              size="sm"
              className="h-8 flex-1 rounded-full px-2 text-[11px]"
              disabled={isToggling || !isReady}
              onClick={handleToggle}
            >
              {platform.common.done}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div id="dashboard-cardio" className={cn(dashboard.tile, "relative p-4")}>
      {completedForDay && cardioForDay ? (
        <div className="absolute right-3 top-3 z-10">
          <DashboardStatusIcon status="completed" aria-label={platform.aria.completed} />
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3 pr-8">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-orange-400" />
          <p className="text-lg font-black">{cardioTitle(selectedDate, platform)}</p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <Link href="/dashboard/workout/cardio">
            <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs">
              {platform.cardio.myCardio}
            </Button>
          </Link>
          {cardioForDay && !completedForDay ? (
            <Button
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              disabled={isToggling || !isReady}
              onClick={handleToggle}
            >
              {platform.common.done}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {isReady && cardioForDay ? (
          <>
            <div className={dashboard.listRow}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    cardioIconBg
                  )}
                >
                  <CardioTypeIcon className={cn("h-5 w-5", cardioIconAccent)} />
                </div>
                <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "font-semibold",
                      completedForDay && "text-muted-foreground line-through"
                    )}
                  >
                    {cardioForDay.title}
                  </p>
                  {cardioForDay.duration_minutes != null && (
                    <Badge variant="secondary">
                      {platform.common.min(cardioForDay.duration_minutes)}
                    </Badge>
                  )}
                </div>
                {cardioForDay.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{cardioForDay.description}</p>
                )}
                </div>
              </div>
            </div>
            {cardioForDay.youtube_url && (
              <ExerciseVideoPlayer videoUrl={cardioForDay.youtube_url} title={cardioForDay.title} />
            )}
          </>
        ) : isReady ? (
          <DashboardEmptyState>
            <p>{coachLabels.noCardioToday}</p>
            <Link href="/dashboard/workout/cardio" className="mt-3 inline-block">
              <Button size="sm" variant="outline" className="rounded-full">
                {platform.cardio.addScheduleCardio}
              </Button>
            </Link>
          </DashboardEmptyState>
        ) : null}
      </div>
    </div>
  );
}
