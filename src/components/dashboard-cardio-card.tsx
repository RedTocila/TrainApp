"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { format, isToday, isTomorrow } from "date-fns";
import { HeartPulse } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DashboardCardNavBody,
  DashboardCardNavLink,
  dashboardInteractive,
} from "@/components/dashboard-card-nav-link";
import { useSelectedDate, useIsPastSelectedDay } from "@/components/date-provider";
import { useOptionalDashboardEnrichment } from "@/components/dashboard-enrichment-provider";
import { useDashboardSync } from "@/components/dashboard-sync";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { DashboardStatusCheck } from "@/components/section-completed-badge";
import { dashboard, DashboardEmptyState } from "@/components/dashboard-ui";
import { getCardioTypeDisplay } from "@/lib/cardio-catalog";
import { getScheduledCardioForDate } from "@/lib/actions/user-cardio";
import { getCardioCompletionForDate } from "@/lib/actions/task-completions";
import { formatCardioElapsedMinutes } from "@/lib/cardio-completion";
import { cardioTaskId } from "@/lib/cardio-task-id";
import { isCardioTimerActive } from "@/lib/cardio-timer-storage";
import { useCachedDashboardDate } from "@/hooks/use-cached-dashboard-date";
import type { ClientSchedule } from "@/lib/daily-tasks";
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

type CardioDayData = {
  scheduled: ScheduledCardio | null;
  completed: boolean;
  elapsedSeconds: number | null;
};

function isCardioCompletedForEntry(
  scheduled: ScheduledCardio | null | undefined,
  dateKey: string,
  completions: string[] | undefined
): boolean {
  const cardioId = scheduled?.cardio_id ?? scheduled?.client_cardio?.id ?? null;
  if (!cardioId) return false;
  return (completions ?? []).includes(cardioTaskId(dateKey, cardioId));
}

export function DashboardCardioCard({
  clientId,
  initialScheduled = null,
  initialCompleted = false,
  initialElapsedSeconds = null,
  variant = "compact",
  schedule,
}: {
  clientId: string;
  initialScheduled?: ScheduledCardio | null;
  initialCompleted?: boolean;
  initialElapsedSeconds?: number | null;
  variant?: "full" | "compact";
  schedule?: ClientSchedule;
}) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const { selectedDate, todayKey } = useSelectedDate();
  const readOnly = useIsPastSelectedDay();
  const { version, patches } = useDashboardSync();
  const enrichment = useOptionalDashboardEnrichment()?.enrichment;
  const dateKey = formatDateKey(selectedDate);
  const compact = variant === "compact";
  const sessionHref = `/dashboard/workout/cardio/session?date=${dateKey}`;
  const [sessionActive, setSessionActive] = useState(false);

  useEffect(() => {
    setSessionActive(isCardioTimerActive(dateKey));
  }, [dateKey, version]);

  const seedCardio = useMemo((): CardioDayData | undefined => {
    if (dateKey === todayKey) {
      return {
        scheduled: initialScheduled,
        completed: initialCompleted,
        elapsedSeconds: initialElapsedSeconds,
      };
    }
    const scheduleEntry = schedule?.scheduledCardioEntries?.find(
      (entry) => entry.scheduled_date === dateKey
    );
    if (scheduleEntry) {
      const enrichmentCompleted = isCardioCompletedForEntry(
        scheduleEntry,
        dateKey,
        enrichment?.completionsByDate[dateKey]
      );
      return {
        scheduled: scheduleEntry,
        completed: enrichmentCompleted,
        elapsedSeconds: null,
      };
    }
    return undefined;
  }, [
    dateKey,
    todayKey,
    initialScheduled,
    initialCompleted,
    initialElapsedSeconds,
    enrichment?.completionsByDate,
    schedule?.scheduledCardioEntries,
  ]);

  const { data: cardioDay } = useCachedDashboardDate({
    clientId,
    dateKey,
    namespace: "cardio",
    seed: seedCardio,
    skipFetch: seedCardio !== undefined && dateKey !== todayKey,
    deps: [version, seedCardio?.scheduled?.cardio_id ?? null],
    fetcher: async () => {
      const entry = await getScheduledCardioForDate(clientId, dateKey);
      const cardioId = entry?.cardio_id ?? entry?.client_cardio?.id ?? null;
      const completion = await getCardioCompletionForDate(
        clientId,
        dateKey,
        cardioId
      );
      return {
        scheduled: entry,
        completed: completion.completed,
        elapsedSeconds: completion.elapsedSeconds,
      };
    },
  });

  const display = cardioDay ?? seedCardio;
  const scheduled = display?.scheduled ?? null;
  const cardioId = scheduled?.cardio_id ?? scheduled?.client_cardio?.id ?? null;
  const taskId = cardioTaskId(dateKey, cardioId);
  const patchedCompleted = patches.completions[dateKey]?.[taskId];
  const enrichmentCompleted = isCardioCompletedForEntry(
    scheduled,
    dateKey,
    enrichment?.completionsByDate[dateKey]
  );
  const completed =
    patchedCompleted === true ||
    display?.completed === true ||
    enrichmentCompleted;
  const elapsedSeconds = display?.elapsedSeconds ?? null;
  const cardio = scheduled?.client_cardio ?? null;
  const cardioForDay = cardio;
  const completedForDay = completed;
  const cardioDisplay = cardioForDay
    ? getCardioTypeDisplay(cardioForDay.title, platform.cardio.types)
    : null;
  const CardioTypeIcon = cardioDisplay?.icon ?? HeartPulse;
  const cardioIconAccent = cardioDisplay?.accentClass ?? "text-orange-400";
  const cardioIconBg = cardioDisplay?.bgClass ?? "bg-orange-500/15";

  const startLabel = sessionActive
    ? platform.cardio.continueCardio
    : platform.cardio.startCardio;

  const durationBadge = (() => {
    if (completedForDay && elapsedSeconds != null) {
      const doneMin = formatCardioElapsedMinutes(elapsedSeconds);
      if (cardioForDay?.duration_minutes != null) {
        return `${platform.common.min(doneMin)} / ${platform.common.min(cardioForDay.duration_minutes)}`;
      }
      return platform.common.min(doneMin);
    }
    if (cardioForDay?.duration_minutes != null) {
      return platform.common.min(cardioForDay.duration_minutes);
    }
    return null;
  })();

  if (compact) {
    return (
      <div id="dashboard-cardio" className={cn(dashboard.tile, dashboard.pairTile, "relative")}>
        <DashboardCardNavLink
          href="/dashboard/workout/cardio"
          ariaLabel={platform.cardio.title}
        />
        <DashboardCardNavBody className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <HeartPulse className="h-5 w-5 shrink-0 text-orange-400" />
            <p className="truncate text-sm font-black">{platform.cardio.title}</p>
          </div>
          {completedForDay && cardioForDay ? (
            <DashboardStatusCheck aria-label={platform.aria.completed} />
          ) : null}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-2">
          {cardioForDay ? (
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
              {durationBadge && (
                <Badge variant="secondary" className="text-[10px]">
                  {durationBadge}
                </Badge>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-secondary/40 sm:h-20 sm:w-20">
                <HeartPulse className="h-9 w-9 text-muted-foreground/50 sm:h-10 sm:w-10" />
              </div>
              <p className="text-xs text-muted-foreground">{coachLabels.noCardioToday}</p>
            </div>
          )}
        </div>
        <div className={cn("mt-auto flex gap-1.5 pt-2", dashboardInteractive)}>
          <Link href="/dashboard/workout/cardio" className="flex-1">
            <Button size="sm" variant="outline" className="h-8 w-full rounded-full px-2 text-[11px]">
              {platform.cardio.myCardio}
            </Button>
          </Link>
          {cardioForDay && !completedForDay && !readOnly ? (
            <Link href={sessionHref} className="flex-1">
              <Button size="sm" className="h-8 w-full rounded-full px-2 text-[11px]">
                {startLabel}
              </Button>
            </Link>
          ) : null}
        </div>
        </DashboardCardNavBody>
      </div>
    );
  }

  return (
    <div id="dashboard-cardio" className={cn(dashboard.tile, "relative p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <HeartPulse className="h-5 w-5 text-orange-400" />
          <p className="text-lg font-black">{cardioTitle(selectedDate, platform)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link href="/dashboard/workout/cardio">
            <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs">
              {platform.cardio.myCardio}
            </Button>
          </Link>
          {cardioForDay && !completedForDay && !readOnly ? (
            <Link href={sessionHref}>
              <Button size="sm" className="h-8 rounded-full px-3 text-xs">
                {startLabel}
              </Button>
            </Link>
          ) : null}
          {completedForDay && cardioForDay ? (
            <DashboardStatusCheck aria-label={platform.aria.completed} />
          ) : null}
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {cardioForDay ? (
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
                  {durationBadge && (
                    <Badge variant="secondary">
                      {durationBadge}
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
        ) : (
          <DashboardEmptyState>
            <p>{coachLabels.noCardioToday}</p>
            <Link href="/dashboard/workout/cardio" className="mt-3 inline-block">
              <Button size="sm" variant="outline" className="rounded-full">
                {platform.cardio.addScheduleCardio}
              </Button>
            </Link>
          </DashboardEmptyState>
        )}
      </div>
    </div>
  );
}
