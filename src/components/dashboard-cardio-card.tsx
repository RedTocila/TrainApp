"use client";
import { useCoachLabels, useLocale, usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { isToday, isTomorrow } from "date-fns";
import { formatLocalized } from "@/lib/date-locale";
import { HeartPulse } from "lucide-react";
import { useCallback, useMemo } from "react";
import {
  DashboardCardNavBody,
  DashboardCardNavLink,
  dashboardInteractive,
} from "@/components/dashboard-card-nav-link";
import { useSelectedDate, useIsPastSelectedDay } from "@/components/date-provider";
import { useOptionalDashboardEnrichment } from "@/components/dashboard-enrichment-provider";
import { useDashboardSync } from "@/components/dashboard-sync";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { DashboardStatusCheck, DashboardStatusIcon, dashboardCompletionStatus } from "@/components/section-completed-badge";
import { DashboardThemedShell } from "@/components/dashboard-themed-shell";
import {
  dashboard,
  DashboardEmptyState,
} from "@/components/dashboard-ui";
import { getCardioTypeDisplay, localizeCardioTitle } from "@/lib/cardio-catalog";
import { getScheduledCardiosForDate } from "@/lib/actions/user-cardio";
import { getCardioCompletionForDate } from "@/lib/actions/task-completions";
import { formatCardioElapsedMinutes } from "@/lib/cardio-completion";
import { cardioTaskId } from "@/lib/cardio-task-id";
import {
  scheduledCardiosForDate,
  sortScheduledCardios,
} from "@/lib/cardio-utils";
import { useCachedDashboardDate } from "@/hooks/use-cached-dashboard-date";
import { useCardioSessionClock } from "@/hooks/use-cardio-session-clock";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { ScheduledCardio } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";
import { isDayEnded } from "@/lib/meal-times";
import { formatElapsedClock } from "@/lib/workout-duration";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function cardioTitle(
  date: Date,
  platform: ReturnType<typeof usePlatformCopy>,
  locale: ReturnType<typeof useLocale>
) {
  if (isToday(date)) return platform.dashboard.todaysCardio;
  if (isTomorrow(date)) return platform.dashboard.tomorrowsCardio;
  return platform.dashboard.cardioOnDay(formatLocalized(date, "EEEE", locale));
}

type CardioCompletionInfo = {
  completed: boolean;
  elapsedSeconds: number | null;
};

type CardioDayData = {
  scheduled: ScheduledCardio[];
  completions: Record<string, CardioCompletionInfo>;
};

function entryCardioId(scheduled: ScheduledCardio): string | null {
  return scheduled.cardio_id ?? scheduled.client_cardio?.id ?? null;
}

function isCardioCompletedForEntry(
  scheduled: ScheduledCardio,
  dateKey: string,
  completions: string[] | undefined,
  completionMap?: Record<string, CardioCompletionInfo>
): boolean {
  const cardioId = entryCardioId(scheduled);
  if (!cardioId) return false;
  if (completionMap?.[cardioId]?.completed) return true;
  return (completions ?? []).includes(cardioTaskId(dateKey, cardioId));
}

function durationBadgeFor(
  cardio: NonNullable<ScheduledCardio["client_cardio"]>,
  completed: boolean,
  elapsedSeconds: number | null,
  platform: ReturnType<typeof usePlatformCopy>
) {
  if (completed && elapsedSeconds != null) {
    const doneMin = formatCardioElapsedMinutes(elapsedSeconds);
    if (cardio.duration_minutes != null) {
      return `${platform.common.min(doneMin)} / ${platform.common.min(cardio.duration_minutes)}`;
    }
    return platform.common.min(doneMin);
  }
  if (cardio.duration_minutes != null) {
    return platform.common.min(cardio.duration_minutes);
  }
  return null;
}

export function DashboardCardioCard({
  clientId,
  initialScheduled = [],
  initialCompletions = {},
  variant = "compact",
  schedule,
}: {
  clientId: string;
  initialScheduled?: ScheduledCardio | ScheduledCardio[] | null;
  initialCompletions?: Record<string, CardioCompletionInfo>;
  variant?: "full" | "compact";
  schedule?: ClientSchedule;
}) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const locale = useLocale();
  const { selectedDate, todayKey } = useSelectedDate();
  const readOnly = useIsPastSelectedDay();
  const { version, patches } = useDashboardSync();
  const enrichment = useOptionalDashboardEnrichment()?.enrichment;
  const dateKey = formatDateKey(selectedDate);
  const compact = variant === "compact";

  const initialList = useMemo(
    () =>
      sortScheduledCardios(
        Array.isArray(initialScheduled)
          ? initialScheduled
          : initialScheduled
            ? [initialScheduled]
            : []
      ),
    [initialScheduled]
  );

  const seedCardio = useMemo((): CardioDayData | undefined => {
    if (dateKey === todayKey) {
      return {
        scheduled: initialList,
        completions: initialCompletions,
      };
    }
    const scheduleEntries = scheduledCardiosForDate(
      schedule?.scheduledCardioEntries,
      dateKey
    );
    if (scheduleEntries.length > 0) {
      const completions: Record<string, CardioCompletionInfo> = {};
      for (const entry of scheduleEntries) {
        const cardioId = entryCardioId(entry);
        if (!cardioId) continue;
        completions[cardioId] = {
          completed: isCardioCompletedForEntry(
            entry,
            dateKey,
            enrichment?.completionsByDate[dateKey]
          ),
          elapsedSeconds: null,
        };
      }
      return { scheduled: scheduleEntries, completions };
    }
    return undefined;
  }, [
    dateKey,
    todayKey,
    initialList,
    initialCompletions,
    enrichment?.completionsByDate,
    schedule?.scheduledCardioEntries,
  ]);

  const { data: cardioDay } = useCachedDashboardDate({
    clientId,
    dateKey,
    namespace: "cardio",
    seed: seedCardio,
    skipFetch: seedCardio !== undefined && dateKey !== todayKey,
    deps: [
      version,
      seedCardio?.scheduled.map((entry) => entryCardioId(entry)).join(",") ?? "",
    ],
    fetcher: async () => {
      const entries = await getScheduledCardiosForDate(clientId, dateKey);
      const completions: Record<string, CardioCompletionInfo> = {};
      await Promise.all(
        entries.map(async (entry) => {
          const cardioId = entryCardioId(entry);
          if (!cardioId) return;
          const completion = await getCardioCompletionForDate(
            clientId,
            dateKey,
            cardioId
          );
          completions[cardioId] = {
            completed: completion.completed,
            elapsedSeconds: completion.elapsedSeconds,
          };
        })
      );
      return { scheduled: entries, completions };
    },
  });

  const display = cardioDay ?? seedCardio;
  // Only one cardio per day — use the first scheduled entry if any.
  const activeEntry = display?.scheduled[0] ?? null;

  const isEntryCompleted = useCallback(
    (entry: ScheduledCardio) => {
      const cardioId = entryCardioId(entry);
      if (!cardioId) return false;
      const taskId = cardioTaskId(dateKey, cardioId);
      if (patches.completions[dateKey]?.[taskId] === true) return true;
      if (display?.completions[cardioId]?.completed) return true;
      return isCardioCompletedForEntry(
        entry,
        dateKey,
        enrichment?.completionsByDate[dateKey],
        display?.completions
      );
    },
    [dateKey, display?.completions, enrichment?.completionsByDate, patches.completions]
  );

  const activeCardio = activeEntry?.client_cardio ?? null;
  const activeCardioId = activeEntry ? entryCardioId(activeEntry) : null;
  const activeCompleted = activeEntry ? isEntryCompleted(activeEntry) : false;
  const sessionHref = activeCardioId
    ? `/dashboard/workout/cardio/session?date=${dateKey}&cardioId=${encodeURIComponent(activeCardioId)}`
    : `/dashboard/workout/cardio/session?date=${dateKey}`;

  const sessionClock = useCardioSessionClock(dateKey, activeCardioId, version);
  const sessionActive = sessionClock.active && !activeCompleted;

  const startLabel = sessionActive
    ? platform.cardio.continueCardio
    : platform.cardio.startCardio;

  if (compact) {
    const showStart = Boolean(activeCardio && !activeCompleted && !readOnly);
    const elapsed =
      activeCardioId != null
        ? display?.completions[activeCardioId]?.elapsedSeconds ?? null
        : null;
    const typeDisplay = activeCardio
      ? getCardioTypeDisplay(activeCardio.title, platform.cardio.types)
      : null;
    const Icon = typeDisplay?.icon ?? HeartPulse;
    const plannedBadge =
      activeCardio != null
        ? durationBadgeFor(activeCardio, activeCompleted, elapsed, platform)
        : null;
    const sessionBadge = sessionActive
      ? formatElapsedClock(sessionClock.elapsedSeconds)
      : null;
    const badge = sessionBadge ?? plannedBadge;

    return (
      <DashboardThemedShell
        id="dashboard-cardio"
        theme="cardio"
        className={cn(dashboard.pairTile, "relative isolate")}
      >
        <DashboardCardNavLink
          href={sessionActive ? sessionHref : "/dashboard/workout/cardio"}
          ariaLabel={platform.cardio.title}
        />
        <DashboardCardNavBody className="flex flex-1 flex-col gap-1">
          <div className="flex h-7 shrink-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <HeartPulse className="h-5 w-5 shrink-0 text-orange-600 dark:text-orange-300" />
              <p className="truncate text-sm font-black">{platform.cardio.title}</p>
            </div>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center">
              {activeEntry ? (
                <DashboardStatusIcon
                  status={dashboardCompletionStatus(
                    activeCompleted,
                    isDayEnded(dateKey)
                  )}
                  aria-label={
                    activeCompleted
                      ? platform.aria.completed
                      : platform.common.incomplete
                  }
                />
              ) : null}
            </div>
          </div>

          {activeCardio ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-0.5 py-0.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/15 dark:bg-orange-500/20">
                <Icon className="h-6 w-6 text-orange-600 dark:text-orange-300" />
              </div>
              <p
                className={cn(
                  "line-clamp-2 min-h-[2rem] max-w-full px-1 text-center text-xs font-semibold leading-snug",
                  activeCompleted && "text-muted-foreground line-through"
                )}
              >
                {localizeCardioTitle(activeCardio.title, platform.cardio.types)}
              </p>
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5",
                  sessionActive ? "min-h-[2.25rem]" : "min-h-[1.125rem]"
                )}
              >
                {sessionActive ? (
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-300">
                    {sessionClock.paused
                      ? platform.cardio.pause
                      : platform.cardio.ongoing}
                  </p>
                ) : null}
                {badge ? (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "tabular-nums",
                      sessionActive
                        ? "border-orange-500/30 bg-orange-500/15 px-2.5 py-0.5 text-sm font-bold text-orange-700 dark:text-orange-300"
                        : "text-[10px]",
                      sessionClock.running && "animate-pulse"
                    )}
                    aria-label={
                      sessionActive
                        ? sessionClock.running
                          ? platform.cardio.elapsed
                          : platform.cardio.pause
                        : undefined
                    }
                  >
                    {badge}
                  </Badge>
                ) : (
                  <span className="invisible text-[10px]" aria-hidden>
                    —
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-0.5 py-0.5 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/15 dark:bg-orange-500/20">
                <HeartPulse className="h-6 w-6 text-orange-600 dark:text-orange-300" />
              </div>
              <p className="min-h-[2rem] px-1 text-xs leading-snug text-muted-foreground">
                {coachLabels.noCardioToday}
              </p>
              <div className="min-h-[1.125rem]" aria-hidden />
            </div>
          )}

          <div className={cn(dashboard.pairFooter, dashboardInteractive)}>
            <Link
              href="/dashboard/workout/cardio"
              className={cn("min-w-0", showStart ? "flex-1" : "w-full")}
            >
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-full rounded-full border-orange-500/30 bg-orange-500/10 px-2 text-[11px] hover:bg-orange-500/15"
              >
                {platform.cardio.myCardio}
              </Button>
            </Link>
            {showStart ? (
              <Link href={sessionHref} className="min-w-0 flex-1">
                <Button
                  size="sm"
                  className="h-7 w-full rounded-full px-2 text-[11px]"
                >
                  {startLabel}
                </Button>
              </Link>
            ) : null}
          </div>
        </DashboardCardNavBody>
      </DashboardThemedShell>
    );
  }

  const elapsed =
    activeCardioId != null
      ? display?.completions[activeCardioId]?.elapsedSeconds ?? null
      : null;
  const typeDisplay = activeCardio
    ? getCardioTypeDisplay(activeCardio.title, platform.cardio.types)
    : null;
  const Icon = typeDisplay?.icon ?? HeartPulse;
  const plannedBadge =
    activeCardio != null
      ? durationBadgeFor(activeCardio, activeCompleted, elapsed, platform)
      : null;
  const badge = sessionActive
    ? formatElapsedClock(sessionClock.elapsedSeconds)
    : plannedBadge;

  return (
    <div id="dashboard-cardio" className={cn(dashboard.tile, "relative p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <HeartPulse className="h-5 w-5 text-orange-400" />
          <p className="text-lg font-black">{cardioTitle(selectedDate, platform, locale)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link href="/dashboard/workout/cardio">
            <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs">
              {platform.cardio.myCardio}
            </Button>
          </Link>
          {activeCardio && !activeCompleted && !readOnly ? (
            <Link href={sessionHref}>
              <Button size="sm" className="h-8 rounded-full px-3 text-xs">
                {startLabel}
              </Button>
            </Link>
          ) : null}
          {activeCompleted ? (
            <DashboardStatusCheck aria-label={platform.aria.completed} />
          ) : null}
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {activeCardio && activeEntry ? (
          <div className="space-y-3">
            <div className={dashboard.listRow}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 dark:bg-orange-500/20">
                  <Icon className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cn(
                        "font-semibold",
                        activeCompleted && "text-muted-foreground line-through"
                      )}
                    >
                      {localizeCardioTitle(activeCardio.title, platform.cardio.types)}
                    </p>
                    {badge ? (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "tabular-nums",
                          sessionActive
                            ? "border-orange-500/30 bg-orange-500/15 px-2.5 py-0.5 text-sm font-bold text-orange-700 dark:text-orange-300"
                            : undefined,
                          sessionClock.running && "animate-pulse"
                        )}
                      >
                        {sessionActive
                          ? `${sessionClock.paused ? platform.cardio.pause : platform.cardio.ongoing} · ${badge}`
                          : badge}
                      </Badge>
                    ) : null}
                    {activeCompleted ? (
                      <DashboardStatusCheck aria-label={platform.aria.completed} />
                    ) : null}
                  </div>
                  {activeCardio.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeCardio.description}
                    </p>
                  )}
                  {!activeCompleted && !readOnly ? (
                    <Link href={sessionHref} className="mt-2 inline-block">
                      <Button size="sm" className="h-8 rounded-full px-3 text-xs">
                        {startLabel}
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
            {activeCardio.youtube_url && (
              <ExerciseVideoPlayer
                videoUrl={activeCardio.youtube_url}
                title={localizeCardioTitle(activeCardio.title, platform.cardio.types)}
              />
            )}
          </div>
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
