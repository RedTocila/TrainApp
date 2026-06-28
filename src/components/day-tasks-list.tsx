"use client";
import { useCoachLabels, useLocale } from "@/components/locale-provider";

import {
  Apple,
  ChevronDown,
  Dumbbell,
  Droplets,
  HeartPulse,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { type DailyTask, type TaskCategory } from "@/lib/daily-tasks";
import { getTaskDestination, isDashboardDayDetailHref, scrollToSection } from "@/lib/task-navigation";
import { TaskNutritionMacroPreview } from "@/components/task-nutrition-macro-preview";
import { sumMealMacros, type MealMacros } from "@/lib/meal-utils";
import { dashboard } from "@/components/dashboard-ui";
import { DashboardStatusIcon } from "@/components/section-completed-badge";
import { getTaskCategoryLabels } from "@/lib/locale-labels";
import type { DailyMealLog } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_UI: Record<
  TaskCategory,
  { icon: LucideIcon; color: string; bg: string }
> = {
  workout: {
    icon: Dumbbell,
    color: "text-primary",
    bg: "bg-primary/15",
  },
  nutrition: {
    icon: Apple,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
  },
  cardio: {
    icon: HeartPulse,
    color: "text-orange-400",
    bg: "bg-orange-500/15",
  },
  habits: {
    icon: ListChecks,
    color: "text-violet-400",
    bg: "bg-violet-500/15",
  },
  water: {
    icon: Droplets,
    color: "text-sky-400",
    bg: "bg-sky-500/15",
  },
};

function useTaskNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  return (task: DailyTask) => {
    const { href, sectionId } = getTaskDestination(task);
    const onDashboard = pathname === "/dashboard";

    if (isDashboardDayDetailHref(href) || !onDashboard) {
      router.push(href);
      return;
    }

    if (scrollToSection(sectionId)) {
      return;
    }

    router.push(href);
  };
}

function TaskCategoryBadge({ task }: { task: DailyTask }) {
  const { icon: Icon, color } = CATEGORY_UI[task.category];

  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/40"
      aria-hidden
    >
      <Icon className={cn("h-4 w-4", color)} />
    </span>
  );
}

const TASK_STATUS_COLUMN =
  "flex h-7 w-7 shrink-0 items-center justify-center";

function TaskRowStatus({ task }: { task: DailyTask }) {
  const isExceeded = task.exceeded && !task.completed;
  const isMissed = task.missed && !task.completed && !isExceeded;

  if (task.completed) {
    return (
      <DashboardStatusIcon status="completed" aria-label="Completed" />
    );
  }

  if (isMissed) {
    return <DashboardStatusIcon status="missed" aria-label="Missed" />;
  }

  if (isExceeded) {
    return <DashboardStatusIcon status="missed" aria-label="Over limit" />;
  }

  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/35"
      aria-label="Not completed"
    />
  );
}

export function TaskRow({
  task,
  macroTargets,
  dailyMeals,
  variant = "default",
}: {
  task: DailyTask;
  macroTargets?: MealMacros;
  dailyMeals?: DailyMealLog[];
  variant?: "default" | "dropdown";
}) {
  const navigate = useTaskNavigation();
  const locale = useLocale();
  const categoryLabels = getTaskCategoryLabels(locale);
  const { icon: CategoryIcon, color } = CATEGORY_UI[task.category];
  const isDropdown = variant === "dropdown";

  const showMacroPreview =
    task.category === "nutrition" &&
    task.id.endsWith("-nutrition") &&
    !task.id.endsWith("-nutrition-pending") &&
    macroTargets &&
    dailyMeals;

  const macroCurrent = showMacroPreview ? sumMealMacros(dailyMeals) : null;

  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(task)}
        className={cn(
          isDropdown
            ? dashboard.dropdownItem
            : cn(
                dashboard.listRow,
                "w-full cursor-pointer touch-manipulation select-none items-start gap-3 py-2.5 pl-2 pr-3 text-left active:scale-[0.99] hover:bg-card/60"
              )
        )}
      >
        {!isDropdown ? <TaskCategoryBadge task={task} /> : null}
        <div className="min-w-0 flex-1 text-left">
          {!isDropdown ? (
            <span
              className={cn(
                "mb-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
              )}
            >
              <CategoryIcon className={cn("h-3 w-3", color)} aria-hidden />
              {categoryLabels[task.category]}
            </span>
          ) : null}
          <p
            className={cn(
              "text-sm font-semibold leading-snug",
              task.completed && "text-muted-foreground line-through"
            )}
          >
            {task.label}
          </p>
          {task.detail && !showMacroPreview && (
            <p
              className={cn(
                "mt-0.5 line-clamp-1 text-xs text-muted-foreground/90",
                task.completed && "line-through"
              )}
            >
              {task.detail}
            </p>
          )}
          {showMacroPreview && macroCurrent && macroTargets && (
            <TaskNutritionMacroPreview
              current={macroCurrent}
              targets={macroTargets}
            />
          )}
        </div>
        <div className={TASK_STATUS_COLUMN}>
          <TaskRowStatus task={task} />
        </div>
      </button>
    </li>
  );
}

const STACKED_CATEGORIES = new Set<TaskCategory>(["workout", "habits"]);

function groupAggregateStatus(tasks: DailyTask[]) {
  if (tasks.length === 0) return null;
  if (tasks.every((task) => task.completed)) {
    return "completed" as const;
  }
  if (tasks.some((task) => task.exceeded && !task.completed)) {
    return "exceeded" as const;
  }
  if (tasks.some((task) => task.missed && !task.completed)) {
    return "missed" as const;
  }
  return "pending" as const;
}

function GroupProgressIcon({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const allComplete = total > 0 && completed === total;

  return (
    <span
      className={cn(
        "h-2.5 w-2.5 shrink-0 rounded-full",
        allComplete ? "bg-green-500" : "bg-yellow-500"
      )}
      aria-hidden
    />
  );
}

function TaskGroupDropdown({
  category,
  tasks,
  macroTargets,
  dailyMeals,
}: {
  category: TaskCategory;
  tasks: DailyTask[];
  macroTargets?: MealMacros;
  dailyMeals?: DailyMealLog[];
}) {
  const locale = useLocale();
  const categoryLabels = getTaskCategoryLabels(locale);
  const { icon: CategoryIcon, color } = CATEGORY_UI[category];
  const completedCount = tasks.filter((task) => task.completed).length;
  const aggregateStatus = groupAggregateStatus(tasks);
  const [open, setOpen] = useState(false);

  return (
    <li className={dashboard.attachedDropdown}>
      <div className={dashboard.attachedDropdownMain}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/40"
          aria-hidden
        >
          <CategoryIcon className={cn("h-4 w-4", color)} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{categoryLabels[category]}</p>
          {tasks[0] ? (
            <p className="truncate text-xs text-muted-foreground">{tasks[0].label}</p>
          ) : null}
        </div>
        <div className={TASK_STATUS_COLUMN}>
          {aggregateStatus === "completed" ? (
            <DashboardStatusIcon status="completed" aria-label="Completed" />
          ) : aggregateStatus === "missed" ? (
            <DashboardStatusIcon status="missed" aria-label="Missed" />
          ) : aggregateStatus === "exceeded" ? (
            <DashboardStatusIcon status="missed" aria-label="Over limit" />
          ) : (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-muted-foreground/35"
              aria-hidden
            />
          )}
        </div>
      </div>

      <div className={dashboard.attachedDropdownTail}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={dashboard.attachedDropdownTailToggle}
          aria-expanded={open}
          aria-controls={`${category}-tasks-panel`}
        >
          <GroupProgressIcon completed={completedCount} total={tasks.length} />
          <span className="min-w-0 flex-1 truncate">
            {completedCount} of {tasks.length} done
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </button>
        {open ? (
          <ul
            id={`${category}-tasks-panel`}
            className="divide-y divide-border/60 border-t border-border/60"
          >
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                macroTargets={macroTargets}
                dailyMeals={dailyMeals}
                variant="dropdown"
              />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function partitionTasksForList(tasks: DailyTask[]) {
  const segments: Array<
    | { kind: "task"; task: DailyTask }
    | { kind: "group"; category: TaskCategory; tasks: DailyTask[] }
  > = [];

  let index = 0;
  while (index < tasks.length) {
    const task = tasks[index];
    if (STACKED_CATEGORIES.has(task.category)) {
      const category = task.category;
      const group: DailyTask[] = [];
      while (index < tasks.length && tasks[index].category === category) {
        group.push(tasks[index]);
        index += 1;
      }
      segments.push({ kind: "group", category, tasks: group });
      continue;
    }
    segments.push({ kind: "task", task });
    index += 1;
  }

  return segments;
}

export function groupTasksByStatus(tasks: DailyTask[]) {
  return {
    active: tasks.filter((t) => !t.completed),
    completed: tasks.filter((t) => t.completed),
    exceeded: tasks.filter((t) => t.exceeded && !t.completed),
    missed: tasks.filter((t) => t.missed && !t.completed && !t.exceeded),
    inProgress: tasks.filter((t) => !t.completed && !t.missed && !t.exceeded),
  };
}

export function DayTasksList({
  tasks,
  macroTargets,
  dailyMeals,
}: {
  tasks: DailyTask[];
  macroTargets?: MealMacros;
  dailyMeals?: DailyMealLog[];
}) {
  const coachLabels = useCoachLabels();

  const segments = useMemo(() => partitionTasksForList(tasks), [tasks]);

  if (tasks.length === 0) {
    return (
      <p className={cn(dashboard.empty, "py-6")}>
        {coachLabels.noTasksToday}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {segments.map((segment) =>
        segment.kind === "group" ? (
          <TaskGroupDropdown
            key={`${segment.category}-group`}
            category={segment.category}
            tasks={segment.tasks}
            macroTargets={macroTargets}
            dailyMeals={dailyMeals}
          />
        ) : (
          <TaskRow
            key={segment.task.id}
            task={segment.task}
            macroTargets={macroTargets}
            dailyMeals={dailyMeals}
          />
        )
      )}
    </ul>
  );
}
