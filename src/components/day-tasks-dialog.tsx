"use client";

import { isToday, isTomorrow } from "date-fns";
import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { getTaskCompletionsForDate } from "@/lib/actions/task-completions";
import { getHabitCompletionsForDate } from "@/lib/actions/habits";
import {
  applyTaskCompletions,
  buildDailyTasks,
  type ClientSchedule,
} from "@/lib/daily-tasks";
import { formatLocalized } from "@/lib/date-locale";
import { formatDateKey } from "@/lib/utils";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { Button } from "@/components/ui/button";

export function DayTasksDialog({
  open,
  date,
  clientId,
  schedule,
  onClose,
}: {
  open: boolean;
  date: Date | null;
  clientId: string;
  schedule: ClientSchedule;
  onClose: () => void;
}) {
  const platform = usePlatformCopy();
  const locale = useLocale();
  const [tasks, setTasks] = useState<ReturnType<typeof buildDailyTasks>>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !date) return;
    const dateKey = formatDateKey(date);
    startTransition(async () => {
      const [scheduleCompletions, habitCompletions] = await Promise.all([
        getTaskCompletionsForDate(clientId, dateKey),
        getHabitCompletionsForDate(clientId, dateKey),
      ]);
      const completed = new Set([
        ...scheduleCompletions,
        ...[...habitCompletions].map((id) => `habit-${id}`),
      ]);
      const built = buildDailyTasks(date, schedule);
      setTasks(applyTaskCompletions(built, completed));
    });
  }, [open, date, clientId, schedule]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !date) return null;

  const { active, missed, completed } = groupTasksByStatus(tasks);
  const dayHeading = isToday(date)
    ? platform.calendar.today
    : isTomorrow(date)
      ? platform.calendar.tomorrow
      : formatLocalized(date, "EEEE", locale);

  return (
    <AppOverlay open={open} onClose={onClose}>
      <AppOverlayPanel maxWidth="max-w-md" aria-label={platform.calendar.tasksFor(
            formatLocalized(date, "MMMM d", locale)
          )} className="max-h-[min(92%,32rem)]">
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {dayHeading}
            </p>
            <h2 className="text-lg font-black">
              {formatLocalized(date, "MMMM d, yyyy", locale)}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {platform.calendar.daySummary(
                active.length,
                completed.length,
                missed.length
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={platform.common.close}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <DayTasksList tasks={tasks} />
        </div>

        <div className="border-t border-border px-5 py-3">
          <Button variant="outline" className="w-full" onClick={onClose}>
            {platform.common.close}
          </Button>
        </div>
      </AppOverlayPanel>
    </AppOverlay>
  );
}
