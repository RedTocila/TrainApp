import type { DailyTask } from "@/lib/daily-tasks";
import type { DailyMealLog } from "@/lib/types";
import { sumMealMacros } from "@/lib/meal-utils";
import {
  isDayEnded,
  isDeadlinePassed,
  WATER_DEADLINE,
  WORKOUT_DEADLINE,
} from "@/lib/meal-times";
import { formatDateKey } from "@/lib/utils";

export interface EnrichTasksContext {
  dateKey: string;
  now?: Date;
  waterMl: number;
  waterGoalMl: number;
  dailyMeals?: DailyMealLog[];
  macroTargets?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  workoutCompleted?: boolean;
}

function dailyMacrosMet(
  meals: DailyMealLog[],
  targets: NonNullable<EnrichTasksContext["macroTargets"]>
): boolean {
  const current = sumMealMacros(meals);
  return (
    current.calories >= targets.calories &&
    current.protein >= targets.protein &&
    current.carbs >= targets.carbs &&
    current.fat >= targets.fat
  );
}

function formatMacroProgress(
  meals: DailyMealLog[],
  targets: NonNullable<EnrichTasksContext["macroTargets"]>
): string {
  const c = sumMealMacros(meals);
  return `${c.calories}/${targets.calories} cal · P ${c.protein}/${targets.protein}g · C ${c.carbs}/${targets.carbs}g · F ${c.fat}/${targets.fat}g`;
}

export function enrichDailyTasks(
  tasks: DailyTask[],
  ctx: EnrichTasksContext
): DailyTask[] {
  const now = ctx.now ?? new Date();

  const enriched = tasks.map((task) => {
    if (task.category === "water") {
      const goal = ctx.waterGoalMl;
      const drank = ctx.waterMl;
      const metGoal = drank >= goal;
      const deadlinePassed = isDeadlinePassed(WATER_DEADLINE, ctx.dateKey, now);

      return {
        ...task,
        label: `Drink ${goal.toLocaleString()} ml water`,
        detail: `${drank.toLocaleString()} / ${goal.toLocaleString()} ml · by ${WATER_DEADLINE}`,
        completed: task.completed || metGoal,
        missed:
          metGoal || task.completed ? false : deadlinePassed || task.missed,
      };
    }

    if (task.category === "workout" && !task.id.endsWith("-pending")) {
      const deadlinePassed = isDeadlinePassed(WORKOUT_DEADLINE, ctx.dateKey, now);
      const completed = task.completed || ctx.workoutCompleted;
      const detailBase = task.detail ?? "";
      const deadlineNote = `Complete by ${WORKOUT_DEADLINE}`;

      return {
        ...task,
        detail: detailBase ? `${detailBase} · ${deadlineNote}` : deadlineNote,
        completed,
        missed: completed ? false : deadlinePassed || task.missed,
      };
    }

    if (
      task.category === "nutrition" &&
      task.id.endsWith("-nutrition") &&
      !task.id.endsWith("-nutrition-pending") &&
      ctx.macroTargets
    ) {
      const meals = ctx.dailyMeals ?? [];
      const met = dailyMacrosMet(meals, ctx.macroTargets);
      const deadlinePassed = isDeadlinePassed(WATER_DEADLINE, ctx.dateKey, now);

      return {
        ...task,
        label: "Hit daily macros",
        detail: formatMacroProgress(meals, ctx.macroTargets),
        completed: met || task.completed,
        missed: met || task.completed ? false : deadlinePassed,
      };
    }

    return task;
  });

  if (!isDayEnded(ctx.dateKey, now)) return enriched;

  return enriched.map((task) =>
    task.completed ? task : { ...task, missed: true }
  );
}

/** @deprecated Use enrichDailyTasks */
export function enrichWaterTask(
  tasks: DailyTask[],
  waterMl: number,
  waterGoalMl: number,
  dateKey: string = formatDateKey(new Date())
): DailyTask[] {
  return enrichDailyTasks(tasks, { dateKey, waterMl, waterGoalMl });
}
