"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { format, isToday, isTomorrow } from "date-fns";
import { Check, HeartPulse } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSelectedDate } from "@/components/date-provider";
import { useDashboardDateFetch } from "@/components/dashboard-date-loading";
import { useDashboardSync } from "@/components/dashboard-sync";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import {
  SectionCompletedBadge,
  sectionCompletedCardClass,
} from "@/components/section-completed-badge";
import { getScheduledCardioForDate } from "@/lib/actions/user-cardio";
import { getTaskCompletionsForDate, toggleScheduleTaskCompletion } from "@/lib/actions/task-completions";
import type { ScheduledCardio } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}: {
  clientId: string;
  initialScheduled?: ScheduledCardio | null;
  initialCompleted?: boolean;
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

  // Sync SSR props only when the server revalidates — not when the calendar day rolls over.
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

  return (
    <Card
      id="dashboard-cardio"
      className={sectionCompletedCardClass(completedForDay && !!cardioForDay)}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <HeartPulse className="h-5 w-5 text-orange-400" />
          {cardioTitle(selectedDate, platform)}
          {completedForDay && cardioForDay && <SectionCompletedBadge />}
        </CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/dashboard/workout/cardio">
            <Button size="sm" variant="outline">
              {platform.cardio.myCardio}
            </Button>
          </Link>
          {cardioForDay && (
            completedForDay ? (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full border border-green-500 bg-green-500 text-white"
                aria-label={platform.aria.completed}
              >
                <Check className="h-4 w-4" />
              </span>
            ) : (
              <Button size="sm" disabled={isToggling || !isReady} onClick={handleToggle}>
                {platform.common.done}
              </Button>
            )
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isReady && cardioForDay ? (
          <>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className={cn("font-semibold", completedForDay && "text-green-400 line-through")}>
                  {cardioForDay.title}
                </p>
                {cardioForDay.duration_minutes != null && (
                  <Badge variant="secondary">{platform.common.min(cardioForDay.duration_minutes)}</Badge>
                )}
              </div>
              {cardioForDay.description && (
                <p className="mt-1 text-sm text-muted-foreground">{cardioForDay.description}</p>
              )}
            </div>
            {cardioForDay.youtube_url && (
              <ExerciseVideoPlayer videoUrl={cardioForDay.youtube_url} title={cardioForDay.title} />
            )}
          </>
        ) : isReady ? (
          <div className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">{coachLabels.noCardioToday}</p>
            <Link href="/dashboard/workout/cardio" className="mt-2 inline-block">
              <Button size="sm" variant="outline" className="mt-2">
                {platform.cardio.addScheduleCardio}
              </Button>
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
