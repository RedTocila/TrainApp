"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { format, isToday, isTomorrow } from "date-fns";
import { Check, HeartPulse } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSelectedDate } from "@/components/date-provider";
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

  const refreshCardio = useCallback(() => {
    return Promise.all([
      getScheduledCardioForDate(clientId, dateKey),
      getTaskCompletionsForDate(clientId, dateKey),
    ]);
  }, [clientId, dateKey]);

  useEffect(() => {
    let cancelled = false;
    void refreshCardio().then(([entry, ids]) => {
      if (cancelled) return;
      setScheduled(entry);
      setCompleted(ids.has(taskId));
    });
    return () => {
      cancelled = true;
    };
  }, [refreshCardio, taskId, todayKey, version]);

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
      className={cn("mt-6", sectionCompletedCardClass(completed && !!cardio))}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <HeartPulse className="h-5 w-5 text-orange-400" />
          {cardioTitle(selectedDate, platform)}
          {completed && cardio && <SectionCompletedBadge />}
        </CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/dashboard/workout/cardio">
            <Button size="sm" variant="outline">
              {platform.cardio.myCardio}
            </Button>
          </Link>
          {cardio && (
            completed ? (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full border border-green-500 bg-green-500 text-white"
                aria-label={platform.aria.completed}
              >
                <Check className="h-4 w-4" />
              </span>
            ) : (
              <Button size="sm" disabled={isToggling} onClick={handleToggle}>
                {platform.common.done}
              </Button>
            )
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {cardio ? (
          <>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className={cn("font-semibold", completed && "text-green-400 line-through")}>
                  {cardio.title}
                </p>
                {cardio.duration_minutes != null && (
                  <Badge variant="secondary">{platform.common.min(cardio.duration_minutes)}</Badge>
                )}
              </div>
              {cardio.description && (
                <p className="mt-1 text-sm text-muted-foreground">{cardio.description}</p>
              )}
            </div>
            {cardio.youtube_url && (
              <ExerciseVideoPlayer videoUrl={cardio.youtube_url} title={cardio.title} />
            )}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">{coachLabels.noCardioToday}</p>
            <Link href="/dashboard/workout/cardio" className="mt-2 inline-block">
              <Button size="sm" variant="outline" className="mt-2">
                {platform.cardio.addScheduleCardio}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
