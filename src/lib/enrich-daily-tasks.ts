import type { DailyTask } from "@/lib/daily-tasks";
import type { DailyMealLog, Meal } from "@/lib/types";
import {
  getNutritionDayStatus,
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
  planMeals?: Meal[];
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
      !task.id.endsWith("-nutrition-pending")
    ) {
      const planMeals = ctx.planMeals ?? [];
      const status = getNutritionDayStatus(
        planMeals,
        ctx.dailyMeals ?? [],
        ctx.dateKey,
        now
      );

      if (status.total > 0) {
        const progress = `${status.doneCount}/${status.total} meals`;
        const detailBase = task.detail ?? "";
        return {
          ...task,
          detail: detailBase ? `${progress} · ${detailBase}` : progress,
          completed: status.completed || task.completed,
          missed: status.completed || task.completed ? false : status.missed,
        };
      }
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
