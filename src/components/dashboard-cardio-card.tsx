"use client";
import { useCoachLabels, useLocale, usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { isToday, isTomorrow } from "date-fns";
import { formatLocalized } from "@/lib/date-locale";
import { ChevronLeft, ChevronRight, HeartPulse } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  DashboardCarouselDots,
  DashboardEmptyState,
} from "@/components/dashboard-ui";
import { getCardioTypeDisplay, localizeCardioTitle } from "@/lib/cardio-catalog";
import { getScheduledCardiosForDate } from "@/lib/actions/user-cardio";
import { scrollElementIntoHorizontalView } from "@/lib/scroll-horizontal";
import { getCardioCompletionForDate } from "@/lib/actions/task-completions";
import { formatCardioElapsedMinutes } from "@/lib/cardio-completion";
import { cardioTaskId } from "@/lib/cardio-task-id";
import { isCardioTimerActive } from "@/lib/cardio-timer-storage";
import {
  pickDefaultCardioIndex,
  scheduledCardiosForDate,
  sortScheduledCardios,
} from "@/lib/cardio-utils";
import { useCachedDashboardDate } from "@/hooks/use-cached-dashboard-date";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { ScheduledCardio } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";
import { isDayEnded } from "@/lib/meal-times";
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
  const scheduledList = display?.scheduled ?? [];

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [slide, setSlide] = useState(0);

  const scheduledIdsKey = scheduledList.map((entry) => entry.id).join(",");

  useEffect(() => {
    const next = pickDefaultCardioIndex(scheduledList, isEntryCompleted);
    setSlide(next);
    const frame = requestAnimationFrame(() => {
      const node = slideRefs.current[next];
      if (!node) return;
      scrollElementIntoHorizontalView(node, {
        behavior: "auto",
        inline: "start",
        scroller: scrollRef.current,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [dateKey, scheduledIdsKey]); // intentionally omit isEntryCompleted — don't jump slides when completions change

  const scrollToSlide = useCallback((index: number) => {
    const node = slideRefs.current[index];
    if (node) {
      scrollElementIntoHorizontalView(node, {
        behavior: "smooth",
        inline: "start",
        scroller: scrollRef.current,
      });
    }
    setSlide(index);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || scheduledList.length <= 1) return;

    const onScroll = () => {
      const slides = slideRefs.current.filter(
        (node): node is HTMLDivElement => node !== null
      );
      if (slides.length === 0) return;

      const scrollLeft = el.scrollLeft;
      let closest = 0;
      let minDistance = Infinity;

      slides.forEach((slideNode, index) => {
        const distance = Math.abs(slideNode.offsetLeft - scrollLeft);
        if (distance < minDistance) {
          minDistance = distance;
          closest = index;
        }
      });

      setSlide(closest);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scheduledList.length]);

  const activeEntry = scheduledList[slide] ?? scheduledList[0] ?? null;
  const activeCardio = activeEntry?.client_cardio ?? null;
  const activeCardioId = activeEntry ? entryCardioId(activeEntry) : null;
  const activeCompleted = activeEntry ? isEntryCompleted(activeEntry) : false;
  const sessionHref = activeCardioId
    ? `/dashboard/workout/cardio/session?date=${dateKey}&cardioId=${encodeURIComponent(activeCardioId)}`
    : `/dashboard/workout/cardio/session?date=${dateKey}`;

  const [sessionActive, setSessionActive] = useState(false);
  useEffect(() => {
    setSessionActive(isCardioTimerActive(dateKey, activeCardioId));
  }, [dateKey, activeCardioId, version]);

  const allCompleted =
    scheduledList.length > 0 && scheduledList.every((entry) => isEntryCompleted(entry));

  const startLabel = sessionActive
    ? platform.cardio.continueCardio
    : platform.cardio.startCardio;

  if (compact) {
    const showStart = Boolean(activeCardio && !activeCompleted && !readOnly);

    return (
      <DashboardThemedShell
        id="dashboard-cardio"
        theme="cardio"
        className={cn(dashboard.pairTile, "relative isolate")}
      >
        <DashboardCardNavLink
          href="/dashboard/workout/cardio"
          ariaLabel={platform.cardio.title}
        />
        <DashboardCardNavBody className="flex flex-1 flex-col">
          <div className="flex h-7 shrink-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <HeartPulse className="h-5 w-5 shrink-0 text-orange-600 dark:text-orange-300" />
              <p className="truncate text-sm font-black">{platform.cardio.title}</p>
            </div>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center">
              {scheduledList.length > 0 ? (
                <DashboardStatusIcon
                  status={dashboardCompletionStatus(
                    allCompleted,
                    isDayEnded(dateKey)
                  )}
                  aria-label={
                    allCompleted
                      ? platform.aria.completed
                      : platform.common.incomplete
                  }
                />
              ) : null}
            </div>
          </div>

          {scheduledList.length > 0 ? (
            <div className="flex flex-1 flex-col justify-center gap-1.5 py-1">
                <div
                  className={cn(
                    "relative flex items-center gap-0.5",
                    dashboardInteractive
                  )}
                >
                  {scheduledList.length > 1 ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        scrollToSlide(Math.max(0, slide - 1));
                      }}
                      disabled={slide <= 0}
                      aria-label={
                        scheduledList[slide - 1]?.client_cardio?.title
                          ? `Previous: ${localizeCardioTitle(
                              scheduledList[slide - 1]!.client_cardio!.title,
                              platform.cardio.types
                            )}`
                          : "Previous cardio"
                      }
                      className={cn(
                        "pointer-events-auto relative z-[2] flex h-8 w-7 shrink-0 items-center justify-center rounded-full",
                        "text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                        "disabled:pointer-events-none disabled:opacity-25"
                      )}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  ) : null}

                  <div
                    ref={scrollRef}
                    className={cn(
                      "min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto",
                      "flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                      "pointer-events-auto relative z-[2] touch-pan-x overscroll-x-contain"
                    )}
                    aria-label={platform.cardio.title}
                  >
                    {scheduledList.map((entry, index) => {
                      const cardio = entry.client_cardio;
                      if (!cardio) return null;
                      const completed = isEntryCompleted(entry);
                      const cardioId = entryCardioId(entry);
                      const elapsed =
                        cardioId != null
                          ? display?.completions[cardioId]?.elapsedSeconds ?? null
                          : null;
                      const typeDisplay = getCardioTypeDisplay(
                        cardio.title,
                        platform.cardio.types
                      );
                      const Icon = typeDisplay?.icon ?? HeartPulse;
                      const iconAccent = "text-orange-600 dark:text-orange-300";
                      const iconBg = "bg-orange-500/15 dark:bg-orange-500/20";
                      const badge = durationBadgeFor(
                        cardio,
                        completed,
                        elapsed,
                        platform
                      );

                      return (
                        <div
                          key={entry.id}
                          ref={(node) => {
                            slideRefs.current[index] = node;
                          }}
                          className="flex w-full shrink-0 snap-start flex-col items-center justify-center gap-1 px-0.5"
                        >
                          <div
                            className={cn(
                              "flex h-16 w-16 items-center justify-center rounded-2xl sm:h-[4.25rem] sm:w-[4.25rem]",
                              iconBg
                            )}
                          >
                            <Icon className={cn("h-8 w-8 sm:h-9 sm:w-9", iconAccent)} />
                          </div>
                          <p
                            className={cn(
                              "line-clamp-2 min-h-[2.25rem] max-w-full px-1 text-center text-xs font-semibold leading-snug sm:min-h-[2.5rem] sm:text-sm",
                              completed && "text-muted-foreground line-through"
                            )}
                          >
                            {localizeCardioTitle(cardio.title, platform.cardio.types)}
                          </p>
                          <div className="flex min-h-[1.25rem] items-center justify-center">
                            {badge ? (
                              <Badge variant="secondary" className="text-[10px]">
                                {badge}
                              </Badge>
                            ) : (
                              <span className="invisible text-[10px]" aria-hidden>
                                —
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {scheduledList.length > 1 ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        scrollToSlide(
                          Math.min(scheduledList.length - 1, slide + 1)
                        );
                      }}
                      disabled={slide >= scheduledList.length - 1}
                      aria-label={
                        scheduledList[slide + 1]?.client_cardio?.title
                          ? `Next: ${localizeCardioTitle(
                              scheduledList[slide + 1]!.client_cardio!.title,
                              platform.cardio.types
                            )}`
                          : "Next cardio"
                      }
                      className={cn(
                        "pointer-events-auto relative z-[2] flex h-8 w-7 shrink-0 items-center justify-center rounded-full",
                        "text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                        "disabled:pointer-events-none disabled:opacity-25"
                      )}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                {scheduledList.length > 1 ? (
                  <div className={cn("pointer-events-auto relative z-[2]", dashboardInteractive)}>
                    <DashboardCarouselDots
                      count={scheduledList.length}
                      active={Math.min(slide, scheduledList.length - 1)}
                      onSelect={scrollToSlide}
                      getLabel={(index) => {
                        const title = scheduledList[index]?.client_cardio?.title;
                        return title
                          ? localizeCardioTitle(title, platform.cardio.types)
                          : `Cardio ${index + 1}`;
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-2 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/15 sm:h-[4.25rem] sm:w-[4.25rem] dark:bg-orange-500/20">
                  <HeartPulse className="h-8 w-8 text-orange-600 sm:h-9 sm:w-9 dark:text-orange-300" />
                </div>
                <p className="min-h-[2.25rem] text-xs leading-snug text-muted-foreground sm:min-h-[2.5rem]">
                  {coachLabels.noCardioToday}
                </p>
                <div className="min-h-[1.25rem]" aria-hidden />
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
                  className="h-8 w-full rounded-full border-orange-500/30 bg-orange-500/10 px-2 text-[11px] hover:bg-orange-500/15"
                >
                  {platform.cardio.myCardio}
                </Button>
              </Link>
              {showStart ? (
                <Link href={sessionHref} className="min-w-0 flex-1">
                  <Button
                    size="sm"
                    className="h-8 w-full rounded-full px-2 text-[11px]"
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
          {allCompleted ? (
            <DashboardStatusCheck aria-label={platform.aria.completed} />
          ) : null}
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {scheduledList.length > 0 ? (
          scheduledList.map((entry) => {
            const cardio = entry.client_cardio;
            if (!cardio) return null;
            const completed = isEntryCompleted(entry);
            const cardioId = entryCardioId(entry);
            const elapsed =
              cardioId != null
                ? display?.completions[cardioId]?.elapsedSeconds ?? null
                : null;
            const typeDisplay = getCardioTypeDisplay(cardio.title, platform.cardio.types);
            const Icon = typeDisplay?.icon ?? HeartPulse;
            const iconAccent = "text-orange-600 dark:text-orange-300";
            const iconBg = "bg-orange-500/15 dark:bg-orange-500/20";
            const badge = durationBadgeFor(cardio, completed, elapsed, platform);
            const href = cardioId
              ? `/dashboard/workout/cardio/session?date=${dateKey}&cardioId=${encodeURIComponent(cardioId)}`
              : sessionHref;

            return (
              <div key={entry.id} className="space-y-3">
                <div className={dashboard.listRow}>
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        iconBg
                      )}
                    >
                      <Icon className={cn("h-5 w-5", iconAccent)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            "font-semibold",
                            completed && "text-muted-foreground line-through"
                          )}
                        >
                          {localizeCardioTitle(cardio.title, platform.cardio.types)}
                        </p>
                        {badge && <Badge variant="secondary">{badge}</Badge>}
                        {completed ? (
                          <DashboardStatusCheck aria-label={platform.aria.completed} />
                        ) : null}
                      </div>
                      {cardio.description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {cardio.description}
                        </p>
                      )}
                      {!completed && !readOnly ? (
                        <Link href={href} className="mt-2 inline-block">
                          <Button size="sm" className="h-8 rounded-full px-3 text-xs">
                            {isCardioTimerActive(dateKey, cardioId)
                              ? platform.cardio.continueCardio
                              : platform.cardio.startCardio}
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
                {cardio.youtube_url && (
                  <ExerciseVideoPlayer
                    videoUrl={cardio.youtube_url}
                    title={localizeCardioTitle(cardio.title, platform.cardio.types)}
                  />
                )}
              </div>
            );
          })
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
