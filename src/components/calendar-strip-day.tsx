"use client";

import type { Ref } from "react";
import { isAfter, isBefore, isToday, startOfDay } from "date-fns";
import { DayCompletionRing } from "@/components/day-completion-ring";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { formatLocalized } from "@/lib/date-locale";
import type { DailyTask, TaskCategory } from "@/lib/daily-tasks";
import type { CalendarDayStatus } from "@/lib/dashboard-task-enrichment";
import {
  getDayCompletionRatio,
  getDayVisualTone,
} from "@/lib/dashboard-task-enrichment";
import { cn } from "@/lib/utils";

const CATEGORY_DOT_COLORS: Record<TaskCategory, string> = {
  workout: "bg-primary",
  nutrition: "bg-emerald-400",
  cardio: "bg-orange-400",
  habits: "bg-violet-400",
  water: "bg-sky-400",
};

interface CalendarStripDayProps {
  date: Date;
  selected: boolean;
  tasks: DailyTask[];
  dayStatus: CalendarDayStatus;
  inactive?: boolean;
  onSelect: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  /** Scroll strip needs a fixed width; grid cells fill their column. */
  layout?: "scroll" | "grid";
  now?: Date;
}

export function CalendarStripDay({
  date,
  selected,
  tasks,
  dayStatus,
  inactive = false,
  onSelect,
  buttonRef,
  layout = "scroll",
  now,
}: CalendarStripDayProps) {
  const platform = usePlatformCopy();
  const locale = useLocale();
  const clock = now ?? new Date();
  const future = isAfter(startOfDay(date), startOfDay(clock));
  const hasTasks = tasks.length > 0;
  const categories = [...new Set(tasks.map((task) => task.category))];
  const doneCount = tasks.filter((task) => task.completed).length;
  const ratio = getDayCompletionRatio(tasks);
  const tone = getDayVisualTone({
    date,
    dayStatus,
    inactive,
    now: clock,
  });
  const ringProgress =
    tone === "green" ? 1 : tone === "red" ? (ratio ?? 0) : 0;

  const dayAbbreviation = isToday(date)
    ? platform.calendar.today
    : formatLocalized(date, "EEE", locale);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onSelect}
      disabled={inactive}
      aria-label={
        ratio == null
          ? formatLocalized(date, "EEEE, MMMM d", locale)
          : platform.calendar.tasksCompletedAria(doneCount, tasks.length)
      }
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col items-center gap-1.5 px-1 py-2 transition-opacity sm:gap-2 sm:py-2.5",
        layout === "scroll"
          ? "w-14 shrink-0 sm:w-[3.75rem] md:w-16"
          : "min-w-0 w-full",
        inactive && "cursor-default opacity-35",
        !inactive && "active:scale-[0.97]"
      )}
    >
      {selected && !inactive && (
        <span
          aria-hidden
          className="absolute inset-x-0.5 inset-y-1 rounded-lg bg-secondary/80"
        />
      )}

      <span
        className={cn(
          "relative z-10 max-w-full truncate text-[0.625rem] font-medium tracking-wide sm:text-[11px]",
          selected && !inactive
            ? "text-foreground"
            : future || inactive || tone === "muted"
              ? "text-muted-foreground/45"
              : "text-muted-foreground"
        )}
      >
        {dayAbbreviation}
      </span>

      <DayCompletionRing
        progress={ringProgress}
        tone={tone}
        size={44}
        stroke={2.5}
        className="relative z-10"
      >
        <span
          className={cn(
            "text-sm font-semibold leading-none tabular-nums sm:text-base",
            inactive || tone === "muted"
              ? "text-muted-foreground/45"
              : "text-foreground"
          )}
        >
          {formatLocalized(date, "d", locale)}
        </span>
      </DayCompletionRing>

      {hasTasks && !inactive && tone === "red" && ratio != null && ratio > 0 && ratio < 1 ? (
        <span className="relative z-10 text-[9px] font-semibold tabular-nums text-red-500">
          {doneCount}/{tasks.length}
        </span>
      ) : hasTasks && !inactive && tone === "muted" && future ? (
        <span className="relative z-10 flex h-1.5 items-center justify-center gap-0.5">
          {categories.slice(0, 3).map((category) => (
            <span
              key={category}
              className={cn(
                "h-1 w-1 rounded-full opacity-40",
                CATEGORY_DOT_COLORS[category]
              )}
            />
          ))}
        </span>
      ) : (
        <span className="relative z-10 h-1.5" aria-hidden />
      )}
    </button>
  );
}

export function isInactiveCalendarDay(
  day: Date,
  activeFrom: Date | null,
  now: Date
): boolean {
  if (!activeFrom) return false;
  return isBefore(startOfDay(day), startOfDay(activeFrom));
}
