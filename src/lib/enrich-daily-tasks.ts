import type { DailyTask } from "@/lib/daily-tasks";
import type { DailyMealLog } from "@/lib/types";
import { sumMealMacros } from "@/lib/meal-utils";
import {
  anyDailyMacroOverTarget,
  dailyMacrosExceededUpperLimit,
  dailyMacrosWithinTarget,
  formatMacroProgressLine,
} from "@/lib/macro-targets";
import { waterMetDailyMinimum } from "@/lib/water-targets";
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

export function enrichDailyTasks(
  tasks: DailyTask[],
  ctx: EnrichTasksContext
): DailyTask[] {
  const now = ctx.now ?? new Date();

  const enriched = tasks.map((task) => {
    if (task.category === "water") {
      const goal = ctx.waterGoalMl;
      const drank = ctx.waterMl;
      const metGoal = waterMetDailyMinimum(drank, goal);
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
      const completed = task.completed;
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
      const current = sumMealMacros(meals);
      const met = dailyMacrosWithinTarget(current, ctx.macroTargets);
      const exceededTolerance = dailyMacrosExceededUpperLimit(current, ctx.macroTargets);
      const exceeded = anyDailyMacroOverTarget(current, ctx.macroTargets);
      const deadlinePassed = isDeadlinePassed(WATER_DEADLINE, ctx.dateKey, now);

      return {
        ...task,
        label: exceededTolerance ? "Daily macros over limit" : "Hit daily macros",
        detail: formatMacroProgressLine(current, ctx.macroTargets),
        completed: met || task.completed,
        exceeded: exceeded && !met && !task.completed,
        missed:
          met || task.completed || exceeded
            ? false
            : deadlinePassed || task.missed,
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
