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
import { getProgressPhotoSets } from "@/lib/actions/progress-photos";
import {
  ensureHabitSchedules,
  getClientHabits,
  getHabitCompletionsInRange,
  getHabitsScheduledInRange,
  getHabitsWithCompletions,
} from "@/lib/actions/habits";
import { fetchDashboardEnrichmentFields } from "@/lib/actions/dashboard-enrichment";
import { getTaskCompletionsInRange } from "@/lib/actions/task-completions";
import { getScheduledWorkoutsInRange } from "@/lib/actions/user-workouts";
import { getScheduledCardioInRange } from "@/lib/actions/user-cardio";
import { scheduledCardioByDateMap } from "@/lib/cardio-utils";
import { getScheduledNutritionInRange, getNutritionPlanForDate } from "@/lib/actions/user-nutrition-schedule";
import { getCoachNutritionPlanViewState } from "@/lib/actions/nutrition-plan-pdf";
import { resolveWorkoutForDate } from "@/lib/actions/workout-sessions";
import { formatDateKey } from "@/lib/utils";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { DashboardDateHeading } from "@/components/dashboard-date-heading";
import { DashboardWorkoutCard } from "@/components/dashboard-workout-card";
import { DashboardCardioCard } from "@/components/dashboard-cardio-card";
import { DayTasksPanel } from "@/components/day-tasks-panel";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { HabitsTracker } from "@/components/habits-tracker";
import { BodyMetricsSection } from "@/components/body-metrics-section";
import { ProgressPhotosCard } from "@/components/progress-photos-card";
import { DashboardOverview } from "@/components/dashboard-overview";
import { hasAiAccess } from "@/lib/subscription";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";
import { getHabitSuggestionsForProfile } from "@/lib/habit-suggestions";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";

export default async function DashboardPage() {
  const profile = await requireClient();
  const today = new Date();
  const dateKey = formatDateKey(today);
  const rangeStart = format(addDays(today, -3), "yyyy-MM-dd");
  const rangeEnd = format(addDays(today, 28), "yyyy-MM-dd");

  void ensureHabitSchedules(profile.id);

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
    scheduledCardioEntries,
    waterGoalMl,
    dailyMeals,
    mealLibrary,
    progressPhotoSets,
    enrichmentFields,
    initialWorkout,
    scheduledPlanForToday,
    coachNutritionPlanState,
    allHabits,
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
    getScheduledCardioInRange(rangeStart, rangeEnd),
    getWaterGoal(profile.id),
    getDailyMealLogs(profile.id, dateKey),
    getPersonalMealsLibrary(),
    getProgressPhotoSets(profile.id),
    fetchDashboardEnrichmentFields(profile.id, rangeStart, rangeEnd),
    resolveWorkoutForDate(profile.id, dateKey),
    getNutritionPlanForDate(profile.id, dateKey),
    getCoachNutritionPlanViewState(profile.id),
    getClientHabits(profile.id),
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

  const scheduledCardioByDate = Object.fromEntries(
    Object.entries(scheduledCardioByDateMap(scheduledCardioEntries)).map(
      ([date, cardio]) => [
        date,
        { title: cardio.title, duration_minutes: cardio.duration_minutes },
      ]
    )
  );

  const initialEnrichment: DashboardEnrichmentData = {
    completionsByDate: completionsSerializable,
    ...enrichmentFields,
    accountCreatedAt: profile.created_at,
  };

  const nutritionPlan = nutritionAssignment?.nutrition_plans;
  const personalNutritionPlanId =
    nutritionPlan?.is_personal && nutritionAssignment?.plan_id
      ? nutritionAssignment.plan_id
      : null;

  const targets = {
    calories: profile.target_calories ?? nutritionPlan?.target_calories ?? 2000,
    protein: profile.target_protein ?? nutritionPlan?.target_protein ?? 150,
    carbs: profile.target_carbs ?? nutritionPlan?.target_carbs ?? 200,
    fat: profile.target_fat ?? nutritionPlan?.target_fat ?? 65,
  };

  const nutritionSummary =
    scheduledPlanForToday?.meals?.length
      ? {
          title: scheduledPlanForToday.title,
          meals: scheduledPlanForToday.meals,
          scheduled: scheduledPlanForToday.scheduled,
          activeSlots: scheduledPlanForToday.activeSlots,
          kind: scheduledPlanForToday.kind,
        }
      : null;

  const aiAccess = hasAiAccess(profile);

  const suggestedHabits = isClientIntakeComplete(profile)
    ? getHabitSuggestionsForProfile(
        profile,
        allHabits.map((habit) => habit.title),
        profile.dismissed_habit_suggestions ?? []
      )
    : [];

  return (
    <>
      <div className="-mx-3 -mt-3 mb-4 sm:-mx-4 sm:-mt-4 sm:mb-6 md:-mx-6 md:-mt-6">
        <DashboardCalendar
          clientId={profile.id}
          schedule={{
            workoutAssignment,
            nutritionAssignment,
            scheduledWorkouts,
            scheduledNutritionDays,
            scheduledCardioByDate,
            habitsByDate,
            waterGoalMl,
            macroTargets: targets,
          }}
          initialEnrichment={initialEnrichment}
        />
      </div>
      <ScrollToHash />
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <DashboardDateHeading />

        <DayTasksPanel
          clientId={profile.id}
          schedule={{
            workoutAssignment,
            nutritionAssignment,
            scheduledWorkouts,
            scheduledNutritionDays,
            scheduledCardioByDate,
            habitsByDate,
            waterGoalMl,
            macroTargets: targets,
          }}
          initialEnrichment={initialEnrichment}
        />

        <DashboardOverview
          clientId={profile.id}
          initialLog={dailyLog}
          initialDailyMeals={dailyMeals}
          mealLibrary={mealLibrary}
          hasAiAccess={aiAccess}
          targets={targets}
          personalPlanId={personalNutritionPlanId}
          initialWaterGoalMl={profile.water_goal_ml ?? 2500}
          nutritionPlan={nutritionSummary}
          coachNutritionPlanState={coachNutritionPlanState}
          goal={profile.goal ?? null}
        />

        <DashboardWorkoutCard
          clientId={profile.id}
          initialWorkout={initialWorkout}
        />

        <DashboardCardioCard clientId={profile.id} />

        <BodyMetricsSection
          clientId={profile.id}
          heightCm={profile.height_cm}
          intakeWeightKg={profile.intake_weight_kg}
          accountCreatedAt={profile.created_at}
          initialHistory={weightHistory}
          initialLog={weightLog}
        />

        <ProgressPhotosCard
          clientId={profile.id}
          initialSets={progressPhotoSets}
        />

        <HabitsTracker
          clientId={profile.id}
          initialHabits={habits}
          suggestedHabits={suggestedHabits}
        />
      </div>
    </>
  );
}
