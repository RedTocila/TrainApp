"use client";

import {
  Apple,
  Check,
  ChevronRight,
  Circle,
  Dumbbell,
  Droplets,
  HeartPulse,
  ListChecks,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  TASK_CATEGORY_LABELS,
  type DailyTask,
  type TaskCategory,
} from "@/lib/daily-tasks";
import { getTaskDestination, scrollToSection } from "@/lib/task-navigation";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<TaskCategory, LucideIcon> = {
  workout: Dumbbell,
  nutrition: Apple,
  cardio: HeartPulse,
  habits: ListChecks,
  water: Droplets,
};

function useTaskNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  return (task: DailyTask) => {
    const { href, sectionId } = getTaskDestination(task);
    const onDashboard = pathname === "/dashboard";
    const onWorkout = pathname === "/dashboard/workout";
    const onNutrition = pathname === "/dashboard/nutrition";

    if (sectionId === "dashboard-workout" && onWorkout) {
      scrollToSection(sectionId);
      return;
    }
    if (sectionId === "dashboard-nutrition" && onNutrition) {
      scrollToSection(sectionId);
      return;
    }
    if (onDashboard && scrollToSection(sectionId)) {
      return;
    }

    router.push(href);
  };
}

export function TaskRow({ task }: { task: DailyTask }) {
  const navigate = useTaskNavigation();
  const Icon = CATEGORY_ICONS[task.category];
  const isMissed = task.missed && !task.completed;
  const isInProgress = !task.completed && !isMissed;

  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(task)}
        className={cn(
          "relative flex w-full items-center gap-2.5 rounded-2xl border border-border bg-secondary/40 px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-secondary/70 sm:items-start sm:gap-3 sm:px-3 sm:py-2.5",
          task.completed && "border-green-500/30 bg-green-500/5 hover:border-green-500/40",
          isMissed && "border-red-500/30 bg-red-500/5 hover:border-red-500/40",
          isInProgress && "border-primary/20"
        )}
      >
        <span
          className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:mt-0.5 sm:h-10 sm:w-10",
            task.completed
              ? "bg-green-500/15 text-green-400"
              : isMissed
                ? "bg-red-500/15 text-red-400"
                : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background",
              task.completed
                ? "bg-green-500 text-white"
                : isMissed
                  ? "bg-red-500 text-white"
                  : "bg-secondary text-primary"
            )}
          >
            {task.completed ? (
              <Check className="h-2.5 w-2.5" />
            ) : isMissed ? (
              <X className="h-2.5 w-2.5" />
            ) : (
              <Circle className="h-2 w-2 fill-current" />
            )}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:gap-2">
            <span
              className={cn(
                "text-sm font-medium leading-tight",
                task.completed && "text-green-400",
                isMissed && "text-red-400"
              )}
            >
              {task.label}
            </span>
            {task.completed && (
              <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-green-400 sm:text-[10px]">
                Done
              </span>
            )}
            {isInProgress && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-400 sm:text-[10px]">
                In progress
              </span>
            )}
            {isMissed && (
              <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-400 sm:text-[10px]">
                Missed
              </span>
            )}
          </div>
          {task.detail && (
            <p
              className={cn(
                "mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:line-clamp-none sm:text-xs",
                task.category === "water" && !task.completed && "font-medium text-sky-400"
              )}
            >
              {task.detail}
            </p>
          )}
          <p className="mt-0.5 hidden text-[10px] uppercase tracking-wider text-muted-foreground sm:mt-1 sm:block">
            {TASK_CATEGORY_LABELS[task.category]}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

export function groupTasksByStatus(tasks: DailyTask[]) {
  return {
    active: tasks.filter((t) => !t.completed),
    completed: tasks.filter((t) => t.completed),
    missed: tasks.filter((t) => t.missed && !t.completed),
    inProgress: tasks.filter((t) => !t.completed && !t.missed),
  };
}

export function DayTasksList({ tasks }: { tasks: DailyTask[] }) {
  const { inProgress, missed, completed } = groupTasksByStatus(tasks);

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No tasks scheduled for this day.</p>
    );
  }

  return (
    <div className="space-y-4">
      {inProgress.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
            In progress
          </h3>
          <ul className="space-y-2">
            {inProgress.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </section>
      )}
      {missed.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
            Missed
          </h3>
          <ul className="space-y-2">
            {missed.map((task) => (
              <TaskRow key={task.id} task={task} />
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
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
