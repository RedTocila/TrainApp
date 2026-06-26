"use client";

import {
  Apple,
  Check,
  Circle,
  Dumbbell,
  Droplets,
  HeartPulse,
  ListChecks,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  TASK_CATEGORY_LABELS,
  type DailyTask,
  type TaskCategory,
} from "@/lib/daily-tasks";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<TaskCategory, LucideIcon> = {
  workout: Dumbbell,
  nutrition: Apple,
  cardio: HeartPulse,
  habits: ListChecks,
  water: Droplets,
};

function AdminTaskRow({ task }: { task: DailyTask }) {
  const Icon = CATEGORY_ICONS[task.category];
  const isExceeded = task.exceeded && !task.completed;
  const isMissed = task.missed && !task.completed && !isExceeded;
  const isInProgress = !task.completed && !isMissed && !isExceeded;

  return (
    <li
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-border bg-secondary/40 px-3 py-2.5",
        task.completed && "border-green-500/30 bg-green-500/5",
        isExceeded && "border-orange-500/30 bg-orange-500/5",
        isMissed && "border-red-500/30 bg-red-500/5",
        isInProgress && "border-primary/20"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          task.completed
            ? "bg-green-500/15 text-green-400"
            : isExceeded
              ? "bg-orange-500/15 text-orange-400"
              : isMissed
                ? "bg-red-500/15 text-red-400"
                : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              task.completed && "text-green-400",
              isExceeded && "text-orange-400",
              isMissed && "text-red-400"
            )}
          >
            {task.label}
          </span>
          {task.completed && (
            <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-green-400">
              Done
            </span>
          )}
          {isExceeded && (
            <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-orange-400">
              Too much
            </span>
          )}
          {isMissed && (
            <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-400">
              Missed
            </span>
          )}
          {isInProgress && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-400">
              In progress
            </span>
          )}
        </div>
        {task.detail && (
          <p className="mt-0.5 text-xs text-muted-foreground">{task.detail}</p>
        )}
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {TASK_CATEGORY_LABELS[task.category]}
        </p>
      </div>
      <span className="text-muted-foreground">
        {task.completed ? (
          <Check className="h-4 w-4 text-green-400" />
        ) : isMissed ? (
          <X className="h-4 w-4 text-red-400" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </span>
    </li>
  );
}

export function AdminDayTasksList({ tasks }: { tasks: DailyTask[] }) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No tasks scheduled for this day.</p>
    );
  }

  const missed = tasks.filter((t) => t.missed && !t.completed);
  const completed = tasks.filter((t) => t.completed);
  const inProgress = tasks.filter((t) => !t.completed && !t.missed);

  return (
    <div className="space-y-4">
      {inProgress.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
            In progress
          </h3>
          <ul className="space-y-2">
            {inProgress.map((task) => (
              <AdminTaskRow key={task.id} task={task} />
            ))}
          </ul>
        </section>
      )}
      {missed.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
            Missed / lacking
          </h3>
          <ul className="space-y-2">
            {missed.map((task) => (
              <AdminTaskRow key={task.id} task={task} />
            ))}
          </ul>
        </section>
      )}
      {completed.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-400">
            Completed
          </h3>
          <ul className="space-y-2">
            {completed.map((task) => (
              <AdminTaskRow key={task.id} task={task} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
