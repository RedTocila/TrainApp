import type {
  NutritionAssignment,
  ScheduledNutritionDay,
  ScheduledWorkout,
  WorkoutAssignment,
  WorkoutDay,
} from "@/lib/types";
import { formatHabitTimeWindow, getHabitWindowPhase } from "@/lib/habit-utils";
import { formatDateKey } from "@/lib/utils";

export type TaskCategory = "workout" | "nutrition" | "cardio" | "habits" | "water";

export interface DailyTask {
  id: string;
  category: TaskCategory;
  label: string;
  detail?: string;
  completed?: boolean;
  missed?: boolean;
}

export interface ClientSchedule {
  workoutAssignment: WorkoutAssignment | null;
  nutritionAssignment: NutritionAssignment | null;
  waterGoalMl?: number;
  macroTargets?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  scheduledWorkouts?: ScheduledWorkout[];
  scheduledNutritionDays?: ScheduledNutritionDay[];
  scheduledCardioByDate?: Record<string, { title: string; duration_minutes?: number | null }>;
  habitsByDate?: Record<
    string,
    { id: string; title: string; time_start?: string | null; time_end?: string | null }[]
  >;
}


function getScheduledCardioForDate(
  date: Date,
  schedule: ClientSchedule
): { title: string; duration_minutes?: number | null } | null {
  const dateKey = formatDateKey(date);
  return schedule.scheduledCardioByDate?.[dateKey] ?? null;
}

function getScheduledWorkoutDay(
  date: Date,
  scheduledWorkouts: ScheduledWorkout[] | undefined
): (WorkoutDay & { planTitle?: string }) | null {
  if (!scheduledWorkouts?.length) return null;
  const dateKey = formatDateKey(date);
  const entry = scheduledWorkouts.find((s) => s.scheduled_date === dateKey);
  if (!entry?.workout_days) return null;
  return {
    ...entry.workout_days,
    planTitle: entry.workout_plans?.title,
  };
}

function getScheduledNutritionDay(
  date: Date,
  scheduledDays: ScheduledNutritionDay[] | undefined
) {
  if (!scheduledDays?.length) return null;
  const dateKey = formatDateKey(date);
  return scheduledDays.find((s) => s.scheduled_date === dateKey) ?? null;
}

function getWorkoutDayForDate(
  date: Date,
  assignment: WorkoutAssignment | null
): WorkoutDay | null {
  const days =
    assignment?.workout_plans?.workout_days?.sort(
      (a, b) => a.day_index - b.day_index
    ) ?? [];
  if (days.length === 0) return null;
  return days[date.getDay() % days.length] ?? null;
}

export function buildDailyTasks(
  date: Date,
  schedule: ClientSchedule
): DailyTask[] {
  const tasks: DailyTask[] = [];
  const dateKey = formatDateKey(date);
  const waterGoal = schedule.waterGoalMl ?? 2500;

  const scheduledDay = getScheduledWorkoutDay(date, schedule.scheduledWorkouts);
  const workoutDay =
    scheduledDay ?? getWorkoutDayForDate(date, schedule.workoutAssignment);

  if (workoutDay) {
    const exerciseCount = workoutDay.exercises?.length ?? 0;
    tasks.push({
      id: `${dateKey}-workout`,
      category: "workout",
      label: workoutDay.title,
      detail:
        exerciseCount > 0
          ? `${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}${
              scheduledDay?.planTitle ? ` · ${scheduledDay.planTitle}` : ""
            }`
          : scheduledDay?.planTitle,
    });
  } else if (!schedule.workoutAssignment && !schedule.scheduledWorkouts?.length) {
    tasks.push({
      id: `${dateKey}-workout-pending`,
      category: "workout",
      label: "Apply for workout plan",
    });
  }

  const scheduledNutrition = getScheduledNutritionDay(
    date,
    schedule.scheduledNutritionDays
  );
  const scheduledPlan = scheduledNutrition?.nutrition_plans;
  const fallbackPlan = schedule.nutritionAssignment?.nutrition_plans;
  const nutritionPlan = scheduledPlan ?? fallbackPlan;
  const macroTargets = schedule.macroTargets;

  if (macroTargets || nutritionPlan) {
    tasks.push({
      id: `${dateKey}-nutrition`,
      category: "nutrition",
      label: "Hit daily macros",
    });
  } else {
    tasks.push({
      id: `${dateKey}-nutrition-pending`,
      category: "nutrition",
      label: "Apply for nutrition plan",
    });
  }

  const scheduledCardio = getScheduledCardioForDate(date, schedule);
  if (scheduledCardio) {
    tasks.push({
      id: `${dateKey}-cardio`,
      category: "cardio",
      label: scheduledCardio.title,
      detail: scheduledCardio.duration_minutes
        ? `${scheduledCardio.duration_minutes} min`
        : undefined,
    });
  }

  const dayHabits = schedule.habitsByDate?.[dateKey] ?? [];
  const now = new Date();
  for (const habit of dayHabits) {
    const timeDetail = formatHabitTimeWindow(habit.time_start, habit.time_end);
    const phase = getHabitWindowPhase(habit, dateKey, now);
    tasks.push({
      id: `habit-${habit.id}`,
      category: "habits",
      label: habit.title,
      detail: timeDetail,
      missed: phase === "missed",
    });
  }

  tasks.push({
    id: `${dateKey}-water`,
    category: "water",
    label: `Drink ${waterGoal} ml water`,
  });

  return tasks;
}

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  workout: "Workout",
  nutrition: "Nutrition",
  cardio: "Cardio",
  habits: "Habits",
  water: "Water",
};

export function applyTaskCompletions(
  tasks: DailyTask[],
  completedIds: Set<string>
): DailyTask[] {
  return tasks.map((task) => ({
    ...task,
    completed: completedIds.has(task.id),
    missed: completedIds.has(task.id) ? false : task.missed,
  }));
}
