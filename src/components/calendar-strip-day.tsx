"use client";

import type { Ref } from "react";
import { format, isAfter, isBefore, isToday, startOfDay } from "date-fns";
import { Check, X } from "lucide-react";
import type { DailyTask, TaskCategory } from "@/lib/daily-tasks";
import type { CalendarDayStatus } from "@/lib/dashboard-task-enrichment";
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
}

function dayAbbreviation(date: Date): string {
  if (isToday(date)) return "Today";
  return format(date, "EEE");
}

export function CalendarStripDay({
  date,
  selected,
  tasks,
  dayStatus,
  inactive = false,
  onSelect,
  buttonRef,
}: CalendarStripDayProps) {
  const future = isAfter(startOfDay(date), startOfDay(new Date()));
  const hasTasks = tasks.length > 0;
  const categories = [...new Set(tasks.map((task) => task.category))];
  const doneCount = tasks.filter((task) => task.completed).length;

  const isComplete = dayStatus === "complete";
  const isIncompletePast = dayStatus === "incomplete_past";
  const isIncompleteActive = dayStatus === "incomplete_active";

  const circleBorder = cn(
    "flex h-9 w-9 items-center justify-center rounded-full border transition-colors sm:h-10 sm:w-10",
    inactive && "border-border/40",
    !inactive &&
      !selected &&
      future &&
      "border-border/50 border-solid",
    !inactive &&
      !selected &&
      !future &&
      isComplete &&
      "border-green-500/70 border-solid",
    !inactive &&
      !selected &&
      !future &&
      isIncompletePast &&
      "border-red-500/60 border-solid",
    !inactive &&
      !selected &&
      !future &&
      isIncompleteActive &&
      "border-amber-500/70 border-solid",
    !inactive &&
      !selected &&
      !future &&
      !isComplete &&
      !isIncompletePast &&
      !isIncompleteActive &&
      "border-dashed border-muted-foreground/35",
    selected &&
      !inactive &&
      (isComplete
        ? "border-green-500 border-solid"
        : isIncompletePast
          ? "border-red-500 border-solid"
          : isIncompleteActive
            ? "border-amber-500 border-solid"
            : "border-foreground border-solid")
  );

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onSelect}
      disabled={inactive}
      aria-label={format(date, "EEEE, MMMM d")}
      aria-pressed={selected}
      className={cn(
        "group relative flex min-w-[3rem] flex-1 flex-col items-center gap-1.5 px-1 py-2 transition-opacity sm:min-w-0 sm:gap-2 sm:py-2.5",
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
          "relative z-10 text-[0.625rem] font-medium tracking-wide sm:text-[11px]",
          selected && !inactive
            ? "text-foreground"
            : future || inactive
              ? "text-muted-foreground/45"
              : "text-muted-foreground"
        )}
      >
        {dayAbbreviation(date)}
      </span>

      <span className={cn(circleBorder, "relative z-10")}>
        <span
          className={cn(
            "text-sm font-semibold leading-none tabular-nums sm:text-base",
            inactive || (future && !selected)
              ? "text-muted-foreground/45"
              : "text-foreground"
          )}
        >
          {format(date, "d")}
        </span>

        {isComplete && (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 text-white ring-2 ring-background"
            aria-hidden
          >
            <Check className="h-2 w-2" strokeWidth={3} />
          </span>
        )}
        {isIncompletePast && (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-white ring-2 ring-background"
            aria-hidden
          >
            <X className="h-2 w-2" strokeWidth={3} />
          </span>
        )}
      </span>

      {hasTasks && !inactive && !isComplete && !isIncompletePast && (
        <span className="relative z-10 flex h-1.5 items-center justify-center gap-0.5">
          {isIncompleteActive ? (
            <span className="text-[9px] font-semibold tabular-nums text-amber-500">
              {doneCount}/{tasks.length}
            </span>
          ) : (
            categories.slice(0, 3).map((category) => (
              <span
                key={category}
                className={cn(
                  "h-1 w-1 rounded-full",
                  CATEGORY_DOT_COLORS[category],
                  future && "opacity-40"
                )}
              />
            ))
          )}
        </span>
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
