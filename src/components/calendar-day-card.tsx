"use client";

import { format, isSameDay, isToday, isTomorrow } from "date-fns";
import { motion } from "framer-motion";
import {
  Apple,
  Check,
  Dumbbell,
  Droplets,
  HeartPulse,
  ListChecks,
  X,
  type LucideIcon,
} from "lucide-react";
import type { DailyTask, TaskCategory } from "@/lib/daily-tasks";
import { TASK_CATEGORY_LABELS } from "@/lib/daily-tasks";
import type { CalendarDayStatus } from "@/lib/dashboard-task-enrichment";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<TaskCategory, LucideIcon> = {
  workout: Dumbbell,
  nutrition: Apple,
  cardio: HeartPulse,
  habits: ListChecks,
  water: Droplets,
};

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  workout: "text-primary",
  nutrition: "text-emerald-400",
  cardio: "text-orange-400",
  habits: "text-violet-400",
  water: "text-sky-400",
};

interface CalendarDayCardProps {
  date: Date;
  selected: boolean;
  tasks: DailyTask[];
  dayStatus?: CalendarDayStatus;
  onSelect: () => void;
  compact?: boolean;
  fluid?: boolean;
  strip?: boolean;
}

function dayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE");
}

function stripDayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tmrw";
  return format(date, "EEE");
}

export function CalendarDayCard({
  date,
  selected,
  tasks,
  dayStatus = "default",
  onSelect,
  compact = false,
  fluid = false,
  strip = false,
}: CalendarDayCardProps) {
  const todayDay = isToday(date);
  const visibleTasks = strip ? tasks.slice(0, 4) : compact ? tasks.slice(0, 4) : tasks;
  const hiddenCount = tasks.length - visibleTasks.length;
  const categories = [...new Set(tasks.map((task) => task.category))];
  const doneCount = tasks.filter((t) => t.completed).length;
  const isComplete = dayStatus === "complete";
  const isIncompletePast = dayStatus === "incomplete_past";

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "calendar-day flex flex-col border text-left transition-colors",
        strip
          ? "min-h-[5.5rem] w-full min-w-0 rounded-lg sm:min-h-[8.75rem] sm:rounded-xl lg:min-h-[11.25rem] lg:rounded-2xl"
          : fluid
            ? "min-w-0 w-full rounded-2xl"
            : compact
              ? "min-w-[148px] max-w-[148px] shrink-0 rounded-2xl"
              : "min-w-[240px] max-w-[240px] shrink-0 rounded-2xl",
        selected
          ? isComplete
            ? "border-green-500 bg-green-500/15"
            : isIncompletePast
              ? "border-red-500 bg-red-500/15"
              : "border-primary bg-primary/10 red-glow"
          : isComplete
            ? "border-green-500/50 bg-green-500/10 hover:bg-green-500/15"
            : isIncompletePast
              ? "border-red-500/50 bg-red-500/10 hover:bg-red-500/15"
              : "border-border bg-secondary/60 hover:bg-secondary/90",
        todayDay && !selected && !isComplete && !isIncompletePast && "ring-2 ring-primary/40"
      )}
    >
      <div
        className={cn(
          "border-b border-border/60",
          strip
            ? "flex flex-col items-center gap-0.5 px-1 py-1.5 text-center sm:flex-row sm:items-start sm:justify-between sm:px-2.5 sm:py-2 sm:text-left md:px-3"
            : cn(
                "flex items-center justify-between",
                compact ? "px-3 py-2" : "px-4 py-3"
              )
        )}
      >
        <div className={cn(strip && "min-w-0 flex flex-col items-center sm:items-start")}>
          <p
            className={cn(
              "truncate font-bold uppercase tracking-wider text-muted-foreground",
              strip
                ? "text-[0.625rem] leading-none sm:text-[10px] md:text-xs"
                : compact
                  ? "text-[10px]"
                  : "text-xs"
            )}
          >
            {strip ? stripDayLabel(date) : dayLabel(date)}
          </p>
          <div
            className={cn(
              "flex flex-col items-center gap-0.5",
              strip && "sm:items-start"
            )}
          >
            <p
              className={cn(
                "font-black leading-none",
                strip
                  ? "text-base sm:text-lg lg:text-2xl"
                  : compact
                    ? "text-lg"
                    : "text-2xl"
              )}
            >
              {format(date, "d")}
            </p>
            {isComplete && (
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full bg-green-500 text-white",
                  strip ? "h-4 w-4 sm:h-5 sm:w-5" : "h-5 w-5"
                )}
                aria-label="All tasks completed"
              >
                <Check className={strip ? "h-2.5 w-2.5 sm:h-3 sm:w-3" : "h-3 w-3"} />
              </span>
            )}
            {isIncompletePast && (
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full bg-red-500 text-white",
                  strip ? "h-4 w-4 sm:h-5 sm:w-5" : "h-5 w-5"
                )}
                aria-label="Tasks incomplete"
              >
                <X className={strip ? "h-2.5 w-2.5 sm:h-3 sm:w-3" : "h-3 w-3"} />
              </span>
            )}
          </div>
        </div>
        <div
          className={cn(
            "text-muted-foreground",
            strip ? "hidden sm:block sm:text-right" : "text-right"
          )}
        >
          <p className="text-[10px] font-medium uppercase">
            {format(date, "MMM")}
          </p>
          <p className="text-[10px] sm:text-xs">
            {doneCount}/{tasks.length} done
          </p>
        </div>
      </div>

      {strip && !isComplete && !isIncompletePast && (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 sm:hidden">
          <div className="flex flex-wrap justify-center gap-0.5">
            {categories.slice(0, 4).map((category) => (
              <span
                key={category}
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  category === "workout" && "bg-primary",
                  category === "nutrition" && "bg-emerald-400",
                  category === "cardio" && "bg-orange-400",
                  category === "habits" && "bg-violet-400",
                  category === "water" && "bg-sky-400"
                )}
                title={TASK_CATEGORY_LABELS[category]}
              />
            ))}
          </div>
          <p className="text-[9px] font-medium text-muted-foreground">
            {tasks.length} tasks
          </p>
        </div>
      )}

      <ul
        className={cn(
          "flex flex-1 flex-col gap-1 overflow-hidden",
          strip
            ? "hidden sm:flex sm:gap-1 sm:px-1.5 sm:py-1.5 md:gap-1.5 md:px-2 md:py-2 lg:px-2.5 lg:py-2.5"
            : cn("gap-1.5", compact ? "px-2 py-2" : "px-3 py-3")
        )}
      >
        {visibleTasks.map((task, index) => {
          const Icon = CATEGORY_ICONS[task.category];
          return (
            <li
              key={task.id}
              className={cn(
                "flex items-start gap-1 rounded-md bg-background/40 md:gap-1.5 md:rounded-lg",
                strip
                  ? cn(
                      "px-1 py-1 md:px-1.5 md:py-1.5 lg:px-2 lg:py-1.5",
                      index >= 2 && "hidden lg:flex",
                      index === 1 && "hidden md:flex"
                    )
                  : compact
                    ? "px-2 py-1.5"
                    : "px-2.5 py-2"
              )}
            >
              {task.completed ? (
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
              ) : task.missed ? (
                <X className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
              ) : (
                <Icon
                  className={cn(
                    "mt-0.5 shrink-0",
                    CATEGORY_COLORS[task.category],
                    strip
                      ? "h-2.5 w-2.5 md:h-3 md:w-3 lg:h-3.5 lg:w-3.5"
                      : compact
                        ? "h-3 w-3"
                        : "h-3.5 w-3.5"
                  )}
                />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate font-medium leading-tight",
                    strip
                      ? "text-[9px] md:text-[10px] lg:text-xs"
                      : compact
                        ? "text-[10px]"
                        : "text-xs",
                    task.completed && "text-muted-foreground line-through"
                  )}
                >
                  {task.label}
                </p>
                {!compact && !strip && task.detail && (
                  <p className="truncate text-[10px] text-muted-foreground">
                    {task.detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
        {hiddenCount > 0 && (
          <li
            className={cn(
              "font-medium text-muted-foreground",
              strip ? "px-1 text-[9px] md:text-[10px]" : "px-2 text-[10px]"
            )}
          >
            +{hiddenCount} more
          </li>
        )}
      </ul>
    </motion.button>
  );
}

export function CalendarDayDot({
  date,
  tasks,
  selected,
  dayStatus = "default",
  onSelect,
}: {
  date: Date;
  tasks: DailyTask[];
  selected: boolean;
  dayStatus?: CalendarDayStatus;
  onSelect: () => void;
}) {
  const todayDay = isToday(date);
  const categories = [...new Set(tasks.map((t) => t.category))];
  const isComplete = dayStatus === "complete";
  const isIncompletePast = dayStatus === "incomplete_past";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex aspect-square flex-col items-center justify-center rounded-xl border text-sm transition-colors",
        selected
          ? isComplete
            ? "border-green-500 bg-green-500/15"
            : isIncompletePast
              ? "border-red-500 bg-red-500/15"
              : "border-primary bg-primary text-primary-foreground"
          : isComplete
            ? "border-green-500/50 bg-green-500/10 hover:bg-green-500/15"
            : isIncompletePast
              ? "border-red-500/50 bg-red-500/10 hover:bg-red-500/15"
              : "border-transparent hover:bg-secondary",
        todayDay && !selected && !isComplete && !isIncompletePast && "ring-2 ring-primary/40"
      )}
    >
      <span className="text-xs font-bold">{format(date, "d")}</span>
      {isComplete ? (
        <span
          className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white"
          aria-label="All tasks completed"
        >
          <Check className="h-2.5 w-2.5" />
        </span>
      ) : isIncompletePast ? (
        <span
          className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white"
          aria-label="Tasks incomplete"
        >
          <X className="h-2.5 w-2.5" />
        </span>
      ) : (
        <div className="mt-1 flex flex-wrap justify-center gap-0.5 px-1">
          {categories.slice(0, 4).map((category) => (
            <span
              key={category}
              className={cn(
                "h-1 w-1 rounded-full",
                selected ? "bg-primary-foreground/80" : "bg-primary/70"
              )}
              title={TASK_CATEGORY_LABELS[category]}
            />
          ))}
        </div>
      )}
    </button>
  );
}

export function isSelectedDay(a: Date, b: Date) {
  return isSameDay(a, b);
}
