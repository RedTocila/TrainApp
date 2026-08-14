import {
  getClientWorkoutAssignment,
  getClientNutritionAssignment,
} from "@/lib/actions/plans";
import { getDailyLog } from "@/lib/actions/logs";
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
  getHabitsScheduledInRange,
  getHabitsWithCompletions,
} from "@/lib/actions/habits";
import { fetchDashboardEnrichmentData } from "@/lib/actions/dashboard-enrichment";
import { getCardioCompletionForDate } from "@/lib/actions/task-completions";
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
} from "@/lib/actions/workout-sessions";
import { getProgressPhotoDisplaySet } from "@/lib/progress-photo-utils";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";
import { getHabitSuggestionsForProfile } from "@/lib/habit-suggestions";
import { hasAiAccess } from "@/lib/subscription";
import type { ClientSchedule } from "@/lib/daily-tasks";
import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";
import type { Profile, ProgressPhotoPose } from "@/lib/types";

export const EMPTY_PHOTO_URLS: Record<ProgressPhotoPose, string | null> = {
  front: null,
  back: null,
  side: null,
};

export async function loadDashboardToday(
  profile: Profile,
  dateKey: string,
  rangeStart: string,
  rangeEnd: string
) {
  const [
    workoutAssignment,
    nutritionAssignment,
    dailyLog,
    weightLog,
    scheduledWorkouts,
    scheduledCardioEntries,
    dailyMeals,
    initialWorkouts,
    scheduledPlanForToday,
    initialWorkoutCompleted,
    initialCardios,
  ] = await Promise.all([
    getClientWorkoutAssignment(profile.id),
    getClientNutritionAssignment(profile.id),
    getDailyLog(profile.id, dateKey),
    getBodyWeightLog(profile.id, dateKey),
    getScheduledWorkoutsInRange(rangeStart, rangeEnd),
    getScheduledCardioInRange(rangeStart, rangeEnd),
    getDailyMealLogs(profile.id, dateKey),
    resolveWorkoutsForDate(profile.id, dateKey),
    getNutritionPlanForDate(profile.id, dateKey),
    isWorkoutCompletedOnDate(profile.id, dateKey),
    getScheduledCardiosForDate(profile.id, dateKey),
  ]);

  const [initialCardioCompletions, initialWorkoutResults] = await Promise.all([
    Promise.all(
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
    ),
    initialWorkoutCompleted
      ? getCompletedWorkoutResultsForDate(profile.id, dateKey)
      : Promise.resolve(null),
  ]);

  const initialCardioCompletionById = Object.fromEntries(
    initialCardioCompletions
      .filter((row) => row.cardioId)
      .map((row) => [
        row.cardioId!,
        { completed: row.completed, elapsedSeconds: row.elapsedSeconds },
      ])
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

  const nutritionSummary = scheduledPlanForToday?.meals?.length
    ? {
        title: scheduledPlanForToday.title,
        meals: scheduledPlanForToday.meals,
        scheduled: scheduledPlanForToday.scheduled,
        activeSlots: scheduledPlanForToday.activeSlots,
        kind: scheduledPlanForToday.kind,
        planId: scheduledPlanForToday.planId,
      }
    : null;

  const waterGoalMl = profile.water_goal_ml ?? 2500;

  const schedule: ClientSchedule = {
    workoutAssignment,
    nutritionAssignment,
    scheduledWorkouts,
    scheduledNutritionDays: [],
    scheduledCardioByDate,
    scheduledCardioEntries,
    habitsByDate: {},
    waterGoalMl,
    macroTargets: targets,
  };

  const initialEnrichment: DashboardEnrichmentData = {
    completionsByDate: {},
    waterByDate: { [dateKey]: dailyLog?.water_ml ?? 0 },
    mealsByDate: { [dateKey]: dailyMeals },
    workoutCompletedDates: initialWorkoutCompleted ? [dateKey] : [],
    accountCreatedAt: profile.created_at,
  };

  return {
    schedule,
    initialEnrichment,
    targets,
    personalNutritionPlanId,
    nutritionSummary,
    waterGoalMl,
    dailyLog,
    dailyMeals,
    weightLog,
    initialWorkouts,
    initialWorkoutCompleted,
    initialWorkoutResults,
    initialCardios,
    initialCardioCompletionById,
    hasAiAccess: hasAiAccess(profile),
  };
}

export async function loadDashboardBelowFold(
  profile: Profile,
  dateKey: string,
  rangeStart: string,
  rangeEnd: string
) {
  const habitBackfill = ensureHabitSchedules(profile.id);

  const [
    mealLibrary,
    progressPhotoSets,
    weightHistory,
    scheduledNutritionDays,
    enrichment,
  ] = await Promise.all([
    getPersonalMealsLibrary(),
    getProgressPhotoSets(profile.id),
    getBodyWeightHistory(profile.id),
    getScheduledNutritionInRange(rangeStart, rangeEnd),
    fetchDashboardEnrichmentData(profile.id, rangeStart, rangeEnd),
    habitBackfill,
  ]);

  const [habits, habitsByDateRaw, allHabits] = await Promise.all([
    getHabitsWithCompletions(profile.id, dateKey),
    getHabitsScheduledInRange(profile.id, rangeStart, rangeEnd),
    getClientHabits(profile.id),
  ]);

  const displayPhotoSet = getProgressPhotoDisplaySet(progressPhotoSets);
  const initialCurrentUrls = displayPhotoSet
    ? await getSignedProgressPhotoUrls(profile.id, displayPhotoSet)
    : EMPTY_PHOTO_URLS;

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

  const suggestedHabits = isClientIntakeComplete(profile)
    ? getHabitSuggestionsForProfile(
        profile,
        allHabits.map((habit) => habit.title),
        profile.dismissed_habit_suggestions ?? []
      )
    : [];

  return {
    mealLibrary,
    progressPhotoSets,
    initialCurrentUrls,
    weightHistory,
    habits,
    scheduledNutritionDays,
    habitsByDate,
    enrichment,
    suggestedHabits,
  };
}
