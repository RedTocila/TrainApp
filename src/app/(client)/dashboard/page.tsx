import { addDays, format } from "date-fns";
import { requireClient } from "@/lib/actions/auth";
import {
  getClientWorkoutAssignment,
  getClientNutritionAssignment,
} from "@/lib/actions/plans";
import { getDailyLog, getWaterGoal } from "@/lib/actions/logs";
import { getDailyMealLogs } from "@/lib/actions/daily-meals";
import { getPersonalMealsLibrary } from "@/lib/actions/user-nutrition";
import {
  getBodyWeightHistory,
  getBodyWeightLog,
} from "@/lib/actions/weight-logs";
import {
  ensureHabitSchedules,
  getHabitCompletionsInRange,
  getHabitsScheduledInRange,
  getHabitsWithCompletions,
} from "@/lib/actions/habits";
import { getTaskCompletionsInRange } from "@/lib/actions/task-completions";
import { getScheduledWorkoutsInRange } from "@/lib/actions/user-workouts";
import { getScheduledNutritionInRange } from "@/lib/actions/user-nutrition-schedule";
import { resolveWorkoutForDate } from "@/lib/actions/workout-sessions";
import { formatDateKey } from "@/lib/utils";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { DashboardDateHeading } from "@/components/dashboard-date-heading";
import { DashboardWorkoutCard } from "@/components/dashboard-workout-card";
import { DayTasksPanel } from "@/components/day-tasks-panel";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { HabitsTracker } from "@/components/habits-tracker";
import { WeightTracker } from "@/components/weight-tracker";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/page-transition";
import { DashboardOverview } from "@/components/dashboard-overview";
import { getPrimaryMealsForDayMenu } from "@/lib/meal-slots";

export default async function DashboardPage() {
  const profile = await requireClient();
  const today = new Date();
  const dateKey = formatDateKey(today);
  const rangeStart = format(addDays(today, -3), "yyyy-MM-dd");
  const rangeEnd = format(addDays(today, 28), "yyyy-MM-dd");

  await ensureHabitSchedules(profile.id);

  const [
    workoutAssignment,
    nutritionAssignment,
    dailyLog,
    weightLog,
    weightHistory,
    habits,
    scheduledWorkouts,
    scheduledNutritionDays,
    completions,
    habitsByDateRaw,
    habitCompletions,
    waterGoalMl,
    dailyMeals,
    mealLibrary,
  ] = await Promise.all([
    getClientWorkoutAssignment(profile.id),
    getClientNutritionAssignment(profile.id),
    getDailyLog(profile.id, dateKey),
    getBodyWeightLog(profile.id, dateKey),
    getBodyWeightHistory(profile.id),
    getHabitsWithCompletions(profile.id, dateKey),
    getScheduledWorkoutsInRange(rangeStart, rangeEnd),
    getScheduledNutritionInRange(rangeStart, rangeEnd),
    getTaskCompletionsInRange(profile.id, rangeStart, rangeEnd),
    getHabitsScheduledInRange(profile.id, rangeStart, rangeEnd),
    getHabitCompletionsInRange(profile.id, rangeStart, rangeEnd),
    getWaterGoal(profile.id),
    getDailyMealLogs(profile.id, dateKey),
    getPersonalMealsLibrary(),
  ]);

  const habitsByDate: Record<
    string,
    { id: string; title: string; time_start?: string | null; time_end?: string | null }[]
  > = {};
  for (const [date, habitsOnDay] of Object.entries(habitsByDateRaw)) {
    habitsByDate[date] = habitsOnDay.map((h) => ({
      id: h.id,
      title: h.title,
      time_start: h.time_start,
      time_end: h.time_end,
    }));
  }

  const completionsSerializable: Record<string, string[]> = {};
  for (const [date, ids] of Object.entries(completions)) {
    completionsSerializable[date] = [...ids];
  }
  for (const [date, ids] of Object.entries(habitCompletions)) {
    const existing = completionsSerializable[date] ?? [];
    completionsSerializable[date] = [...new Set([...existing, ...ids])];
  }

  const nutritionPlan = nutritionAssignment?.nutrition_plans;
  const personalNutritionPlanId =
    nutritionPlan?.is_personal && nutritionAssignment?.plan_id
      ? nutritionAssignment.plan_id
      : null;

  const initialWorkout = await resolveWorkoutForDate(profile.id, dateKey);

  const targets = {
    calories: nutritionPlan?.target_calories ?? profile.target_calories ?? 2000,
    protein: nutritionPlan?.target_protein ?? profile.target_protein ?? 150,
    carbs: nutritionPlan?.target_carbs ?? profile.target_carbs ?? 200,
    fat: nutritionPlan?.target_fat ?? profile.target_fat ?? 65,
  };

  const nutritionSummary = nutritionPlan
    ? {
        title: nutritionPlan.title,
        meals: getPrimaryMealsForDayMenu(nutritionPlan.meals ?? []),
      }
    : null;

  return (
    <>
      <div className="-mx-4 -mt-4 mb-6 md:-mx-6 md:-mt-6">
        <DashboardCalendar
          schedule={{
            workoutAssignment,
            nutritionAssignment,
            scheduledWorkouts,
            scheduledNutritionDays,
            habitsByDate,
            waterGoalMl,
          }}
          completionsByDate={completionsSerializable}
        />
      </div>
      <PageTransition>
      <ScrollToHash />
      <div className="mx-auto max-w-5xl space-y-6">
        <DashboardDateHeading />

        <DayTasksPanel
          clientId={profile.id}
          schedule={{
            workoutAssignment,
            nutritionAssignment,
            scheduledWorkouts,
            scheduledNutritionDays,
            habitsByDate,
            waterGoalMl,
          }}
          completionsByDate={completionsSerializable}
        />

        <DashboardOverview
          clientId={profile.id}
          initialLog={dailyLog}
          initialDailyMeals={dailyMeals}
          mealLibrary={mealLibrary}
          targets={targets}
          personalPlanId={personalNutritionPlanId}
          initialWaterGoalMl={profile.water_goal_ml ?? 2500}
          nutritionPlan={nutritionSummary}
        />

        <StaggerContainer>
          <StaggerItem>
            <DashboardWorkoutCard
              clientId={profile.id}
              initialWorkout={initialWorkout}
            />
          </StaggerItem>
        </StaggerContainer>

        <WeightTracker
          clientId={profile.id}
          initialHistory={weightHistory}
          initialLog={weightLog}
        />

        <HabitsTracker clientId={profile.id} initialHabits={habits} />
      </div>
    </PageTransition>
    </>
  );
}
