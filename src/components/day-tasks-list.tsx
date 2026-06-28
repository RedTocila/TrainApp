"use client";
import { useCoachLabels, useLocale } from "@/components/locale-provider";

import {
  Apple,
  Dumbbell,
  Droplets,
  HeartPulse,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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
}: {
  task: DailyTask;
  macroTargets?: MealMacros;
  dailyMeals?: DailyMealLog[];
}) {
  const navigate = useTaskNavigation();
  const locale = useLocale();
  const categoryLabels = getTaskCategoryLabels(locale);
  const { icon: CategoryIcon, color } = CATEGORY_UI[task.category];

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
          dashboard.listRow,
          "relative w-full cursor-pointer touch-manipulation select-none items-start gap-3 py-2.5 pl-2 pr-10 text-left active:scale-[0.99] hover:bg-card/60"
        )}
      >
        <TaskCategoryBadge task={task} />
        <div className="min-w-0 flex-1 text-left">
          <span
            className={cn(
              "mb-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
            )}
          >
            <CategoryIcon className={cn("h-3 w-3", color)} aria-hidden />
            {categoryLabels[task.category]}
          </span>
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
        <div className="absolute right-2 top-2">
          <TaskRowStatus task={task} />
        </div>
      </button>
    </li>
  );
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

  if (tasks.length === 0) {
    return (
      <p className={cn(dashboard.empty, "py-6")}>
        {coachLabels.noTasksToday}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          macroTargets={macroTargets}
          dailyMeals={dailyMeals}
        />
      ))}
    </ul>
  );
}
