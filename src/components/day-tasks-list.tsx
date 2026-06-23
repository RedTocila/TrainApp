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
          "flex w-full items-start gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-secondary/70",
          task.completed && "opacity-75",
          isMissed && "border-red-500/30 bg-red-500/5 hover:border-red-500/40",
          isInProgress && "border-primary/20"
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
            task.completed
              ? "border-primary bg-primary text-primary-foreground"
              : isMissed
                ? "border-red-500/50 bg-red-500/10 text-red-400"
                : "border-primary/40 bg-primary/10 text-primary"
          )}
        >
          {task.completed ? (
            <Check className="h-3.5 w-3.5" />
          ) : isMissed ? (
            <X className="h-3.5 w-3.5" />
          ) : (
            <Circle className="h-3 w-3" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span
              className={cn(
                "text-sm font-medium",
                task.completed && "text-muted-foreground line-through",
                isMissed && "text-red-400"
              )}
            >
              {task.label}
            </span>
            {task.completed && (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Completed
              </span>
            )}
            {isInProgress && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                In Progress
              </span>
            )}
            {isMissed && (
              <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
                Missed
              </span>
            )}
          </div>
          {task.detail && (
            <p
              className={cn(
                "mt-0.5 text-xs text-muted-foreground",
                task.category === "water" && !task.completed && "font-medium text-sky-400"
              )}
            >
              {task.detail}
            </p>
          )}
          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {TASK_CATEGORY_LABELS[task.category]}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

export function groupTasksByStatus(tasks: DailyTask[]) {
  return {
    inProgress: tasks.filter((t) => !t.completed && !t.missed),
    missed: tasks.filter((t) => t.missed && !t.completed),
    completed: tasks.filter((t) => t.completed),
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
    <div className="space-y-5">
      {inProgress.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
            In Progress
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
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
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
