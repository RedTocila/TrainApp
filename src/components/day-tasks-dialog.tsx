"use client";

import { format, isToday, isTomorrow } from "date-fns";
import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { getTaskCompletionsForDate } from "@/lib/actions/task-completions";
import { getHabitCompletionsForDate } from "@/lib/actions/habits";
import {
  applyTaskCompletions,
  buildDailyTasks,
  type ClientSchedule,
} from "@/lib/daily-tasks";
import { formatDateKey } from "@/lib/utils";
import { DayTasksList, groupTasksByStatus } from "@/components/day-tasks-list";
import { Button } from "@/components/ui/button";

function dayHeading(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE");
}

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
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !date) return null;

  const { inProgress, missed, completed } = groupTasksByStatus(tasks);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Tasks for ${format(date, "MMMM d")}`}
        className="relative z-10 flex max-h-[min(85vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {dayHeading(date)}
            </p>
            <h2 className="text-lg font-black">{format(date, "MMMM d, yyyy")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {inProgress.length} in progress · {completed.length} completed
              {missed.length > 0 ? ` · ${missed.length} missed` : ""}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <DayTasksList tasks={tasks} />
        </div>

        <div className="border-t border-border px-5 py-3">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
