import { addDays, format, startOfDay } from "date-fns";
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
  getProgressPhotoSets,
  getSignedProgressPhotoUrls,
} from "@/lib/actions/progress-photos";
import {
  ensureHabitSchedules,
  getClientHabits,
  getHabitCompletionsInRange,
  getHabitsScheduledInRange,
  getHabitsWithCompletions,
} from "@/lib/actions/habits";
import { fetchDashboardEnrichmentFields } from "@/lib/actions/dashboard-enrichment";
import { mergeWorkoutTaskCompletionsInto } from "@/lib/dashboard-enrichment-utils";
import { getTaskCompletionsInRange, getCardioCompletionForDate } from "@/lib/actions/task-completions";
import { getScheduledWorkoutsInRange } from "@/lib/actions/user-workouts";
import { getScheduledCardioInRange, getScheduledCardiosForDate } from "@/lib/actions/user-cardio";
import { scheduledCardioByDateMap } from "@/lib/cardio-utils";
import {
  getScheduledNutritionInRange,
  getNutritionPlanForDate,
} from "@/lib/actions/user-nutrition-schedule";
import {
  resolveWorkoutsForDate,
  isWorkoutCompletedOnDate,
  getCompletedWorkoutResultsForDate,
  getWorkoutCompletedTaskIdsInRange,
} from "@/lib/actions/workout-sessions";
import { getProgressPhotoDisplaySet } from "@/lib/progress-photo-utils";
import { formatDateKey } from "@/lib/utils";
import { DashboardHomeView } from "@/components/dashboard-home-view";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { DashboardEnrichmentProvider } from "@/components/dashboard-enrichment-provider";
import { hasAiAccess } from "@/lib/subscription";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";
import { getHabitSuggestionsForProfile } from "@/lib/habit-suggestions";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";
import type { ProgressPhotoPose } from "@/lib/types";

const EMPTY_PHOTO_URLS: Record<ProgressPhotoPose, string | null> = {
  front: null,
  back: null,
  side: null,
};

export default async function DashboardPage() {
  const profile = await requireClient();
  const today = new Date();
  const dateKey = formatDateKey(today);
  const accountStart = profile.created_at
    ? format(startOfDay(new Date(profile.created_at)), "yyyy-MM-dd")
    : format(addDays(today, -3), "yyyy-MM-dd");
  const rangeStart = accountStart;
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
    workoutTaskCompletions,
    scheduledCardioEntries,
    waterGoalMl,
    dailyMeals,
    mealLibrary,
    progressPhotoSets,
    enrichmentFields,
    initialWorkouts,
    scheduledPlanForToday,
    allHabits,
    initialWorkoutCompleted,
    initialCardios,
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
    getWorkoutCompletedTaskIdsInRange(profile.id, rangeStart, rangeEnd),
    getScheduledCardioInRange(rangeStart, rangeEnd),
    getWaterGoal(profile.id),
    getDailyMealLogs(profile.id, dateKey),
    getPersonalMealsLibrary(),
    getProgressPhotoSets(profile.id),
    fetchDashboardEnrichmentFields(profile.id, rangeStart, rangeEnd),
    resolveWorkoutsForDate(profile.id, dateKey),
    getNutritionPlanForDate(profile.id, dateKey),
    getClientHabits(profile.id),
    isWorkoutCompletedOnDate(profile.id, dateKey),
    getScheduledCardiosForDate(profile.id, dateKey),
  ]);

  const initialCardioCompletions = await Promise.all(
    initialCardios.map(async (entry) => {
      const cardioId = entry.cardio_id ?? entry.client_cardio?.id ?? null;
      const completion = await getCardioCompletionForDate(
        profile.id,
        dateKey,
        cardioId
      );
      return {
        cardioId,
        completed: completion.completed,
        elapsedSeconds: completion.elapsedSeconds,
      };
    })
  );

  const displayPhotoSet = getProgressPhotoDisplaySet(progressPhotoSets);
  const initialCurrentUrls = displayPhotoSet
    ? await getSignedProgressPhotoUrls(profile.id, displayPhotoSet)
    : EMPTY_PHOTO_URLS;

  const initialCardioCompletionById = Object.fromEntries(
    initialCardioCompletions
      .filter((row) => row.cardioId)
      .map((row) => [
        row.cardioId!,
        { completed: row.completed, elapsedSeconds: row.elapsedSeconds },
      ])
  );

  const initialWorkoutResults = initialWorkoutCompleted
    ? await getCompletedWorkoutResultsForDate(profile.id, dateKey)
    : null;

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
  const mergedCompletions = mergeWorkoutTaskCompletionsInto(
    completionsSerializable,
    workoutTaskCompletions
  );

  const scheduledCardioByDate = Object.fromEntries(
    Object.entries(scheduledCardioByDateMap(scheduledCardioEntries)).map(
      ([date, cardios]) => [
        date,
        cardios.map((cardio) => ({
          id: cardio.id,
          title: cardio.title,
          duration_minutes: cardio.duration_minutes,
        })),
      ]
    )
  );

  const initialEnrichment: DashboardEnrichmentData = {
    completionsByDate: mergedCompletions,
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
          planId: scheduledPlanForToday.planId,
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

  const schedule = {
    workoutAssignment,
    nutritionAssignment,
    scheduledWorkouts,
    scheduledNutritionDays,
    scheduledCardioByDate,
    scheduledCardioEntries: scheduledCardioEntries,
    habitsByDate,
    waterGoalMl,
    macroTargets: targets,
  };

  return (
    <DashboardEnrichmentProvider
      clientId={profile.id}
      initialEnrichment={initialEnrichment}
    >
      <ScrollToHash />
      <DashboardHomeView
        clientId={profile.id}
        schedule={schedule}
        accountCreatedAt={profile.created_at}
        gender={profile.gender}
        initialWorkout={initialWorkouts[0] ?? null}
        initialWorkouts={initialWorkouts}
        initialWorkoutCompleted={initialWorkoutCompleted}
        initialWorkoutResults={initialWorkoutResults}
        initialLog={dailyLog}
        initialDailyMeals={dailyMeals}
        mealLibrary={mealLibrary}
        hasAiAccess={aiAccess}
        targets={targets}
        personalPlanId={personalNutritionPlanId}
        waterGoalMl={profile.water_goal_ml ?? 2500}
        nutritionPlan={nutritionSummary}
        goal={profile.goal ?? null}
        initialWaterMl={dailyLog?.water_ml ?? 0}
        initialCardios={initialCardios}
        initialCardioCompletions={initialCardioCompletionById}
        heightCm={profile.height_cm}
        intakeWeightKg={profile.intake_weight_kg}
        weightHistory={weightHistory}
        weightLog={weightLog}
        progressPhotoSets={progressPhotoSets}
        initialCurrentUrls={initialCurrentUrls}
        habits={habits}
        suggestedHabits={suggestedHabits}
      />
    </DashboardEnrichmentProvider>
  );
}
