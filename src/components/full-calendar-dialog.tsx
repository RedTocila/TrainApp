"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CalendarDayDot } from "@/components/calendar-day-card";
import { tasksForDay } from "@/components/calendar-strip";
import { groupTasksByStatus } from "@/components/day-tasks-list";
import { Button } from "@/components/ui/button";
import type { ClientSchedule } from "@/lib/daily-tasks";
import { cn } from "@/lib/utils";

interface FullCalendarDialogProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  schedule: ClientSchedule;
  completionsByDate: Record<string, Set<string>>;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function FullCalendarDialog({
  open,
  onClose,
  selectedDate,
  onSelectDate,
  schedule,
  completionsByDate,
}: FullCalendarDialogProps) {
  const [viewMonth, setViewMonth] = useState(startOfMonth(selectedDate));

  useEffect(() => {
    if (open) setViewMonth(startOfMonth(selectedDate));
  }, [open, selectedDate]);

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

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const selectedDayTasks = useMemo(
    () => tasksForDay(schedule, completionsByDate, selectedDate),
    [selectedDate, schedule, completionsByDate]
  );
  const { active, completed, missed } = useMemo(
    () => groupTasksByStatus(selectedDayTasks),
    [selectedDayTasks]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close calendar"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Full calendar"
        className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-black">Full Calendar</h2>
            <p className="text-sm text-muted-foreground">
              Tap a day to view its tasks below
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6">
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-base font-bold">{format(viewMonth, "MMMM yyyy")}</h3>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day) => {
              const tasks = tasksForDay(schedule, completionsByDate, day);
              const selected = isSameDay(day, selectedDate);
              const inMonth = isSameMonth(day, viewMonth);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(!inMonth && "opacity-35")}
                >
                  <CalendarDayDot
                    date={day}
                    tasks={tasks}
                    selected={selected}
                    onSelect={() => {
                      onSelectDate(day);
                      onClose();
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-sm font-bold">
              {format(selectedDate, "EEEE, MMMM d")}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {active.length} active · {completed.length} completed
              {missed.length > 0 ? ` · ${missed.length} missed` : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
