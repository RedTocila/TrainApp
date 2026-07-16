import type { DailyTask } from "@/lib/daily-tasks";
import type { DailyMealLog } from "@/lib/types";
import { sumMealMacros } from "@/lib/meal-utils";
import {
  dailyMacrosCountAsTodoExceeded,
  dailyMacrosExceededUpperLimit,
  dailyMacrosWithinTarget,
  formatMacroProgressLine,
} from "@/lib/macro-targets";
import {
  estimateDailyMicros,
  isGoodNutritionHealthScore,
  scoreDailyNutrition,
  sodiumExceededDailyUpperLimit,
} from "@/lib/nutrition-day-utils";
import { waterMetDailyMinimum } from "@/lib/water-targets";
import { dayRelation, isDayEnded } from "@/lib/meal-times";
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

export function enrichDailyTasks(
  tasks: DailyTask[],
  ctx: EnrichTasksContext
): DailyTask[] {
  const now = ctx.now ?? new Date();
  const dayPast = dayRelation(ctx.dateKey, now) === "past";

  const enriched = tasks.map((task) => {
    if (task.category === "water") {
      const goal = ctx.waterGoalMl;
      const drank = ctx.waterMl;
      const metGoal = waterMetDailyMinimum(drank, goal);

      return {
        ...task,
        label: `Drink ${goal.toLocaleString()} ml water`,
        detail: `${drank.toLocaleString()} / ${goal.toLocaleString()} ml`,
        completed: task.completed || metGoal,
        missed: metGoal || task.completed ? false : dayPast || task.missed,
      };
    }

    if (task.category === "workout" && !task.id.endsWith("-pending")) {
      const completed = task.completed;

      return {
        ...task,
        completed,
        missed: completed ? false : dayPast || task.missed,
      };
    }

    if (
      task.category === "nutrition" &&
      task.id.endsWith("-nutrition") &&
      !task.id.endsWith("-nutrition-pending") &&
      ctx.macroTargets
    ) {
      const meals = ctx.dailyMeals ?? [];
      const current = sumMealMacros(meals);
      const micros = estimateDailyMicros(meals, current);
      const met = dailyMacrosWithinTarget(current, ctx.macroTargets);
      const healthScore = scoreDailyNutrition({
        current,
        targets: ctx.macroTargets,
        waterMl: ctx.waterMl,
        waterGoalMl: ctx.waterGoalMl,
        dateKey: ctx.dateKey,
        mealCount: meals.length,
        micros,
      }).score;
      const healthGood = isGoodNutritionHealthScore(healthScore);
      const nutritionDone = met || healthGood;
      const exceededTolerance = dailyMacrosExceededUpperLimit(
        current,
        ctx.macroTargets
      );
      const sodiumExceeded = sodiumExceededDailyUpperLimit(micros.sodium);
      const exceeded =
        dailyMacrosCountAsTodoExceeded(current, ctx.macroTargets) ||
        sodiumExceeded;

      return {
        ...task,
        label:
          exceededTolerance || sodiumExceeded
            ? "Daily macros over limit"
            : healthGood && !met
              ? "Good nutrition day"
              : "Hit daily macros",
        detail: formatMacroProgressLine(current, ctx.macroTargets),
        completed: nutritionDone || task.completed,
        exceeded: exceeded && !nutritionDone && !task.completed,
        missed:
          nutritionDone || task.completed || exceeded
            ? false
            : dayPast || task.missed,
      };
    }

    return task;
  });

  if (!isDayEnded(ctx.dateKey, now)) return enriched;

  return enriched.map((task) => {
    if (task.completed || task.exceeded) return task;
    return { ...task, missed: true };
  });
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
