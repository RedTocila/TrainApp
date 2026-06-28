import type { CoachNutritionPlanViewState } from "@/lib/actions/nutrition-plan-pdf";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import type { MealPlanViewKind } from "@/lib/actions/user-nutrition-schedule";
import type { CompletedWorkoutResults, TodaysWorkoutInfo } from "@/lib/actions/workout-sessions";
import {
  dashboardDayCacheKey,
  getDashboardDayCache,
  isDashboardDayCacheFresh,
  setDashboardDayCache,
} from "@/lib/dashboard-day-cache";
import type { Meal, MealSlot, ProgressPhotoSet } from "@/lib/types";
import type { ProgressPhotoPose } from "@/lib/supabase/storage";

export type WorkoutDayCache = {
  workouts: TodaysWorkoutInfo[];
  completedByTaskId: Record<string, boolean>;
  sessionIdByTaskId?: Record<string, string | null>;
  allCompleted: boolean;
  results: CompletedWorkoutResults | null;
};

export type NutritionExtrasCache = {
  mealLibrary: PersonalMealLibraryItem[];
  coachNutritionPlanState: CoachNutritionPlanViewState;
  personalPlanId: string | null;
  nutritionPlan: {
    title: string;
    meals: Meal[];
    scheduled?: boolean;
    activeSlots?: MealSlot[];
    kind?: MealPlanViewKind;
  } | null;
};

export type PoseUrls = Record<ProgressPhotoPose, string | null>;

export function workoutDayCacheKey(clientId: string, dateKey: string) {
  return dashboardDayCacheKey(clientId, "workout-day", dateKey);
}

export function getWorkoutDayCache(
  clientId: string,
  dateKey: string
): WorkoutDayCache | undefined {
  return getDashboardDayCache<WorkoutDayCache>(workoutDayCacheKey(clientId, dateKey));
}

export function setWorkoutDayCache(
  clientId: string,
  dateKey: string,
  data: WorkoutDayCache
) {
  setDashboardDayCache(workoutDayCacheKey(clientId, dateKey), data);
}

export function nutritionExtrasCacheKey(clientId: string) {
  return `${clientId}:nutrition-extras`;
}

export function getNutritionExtrasCache(
  clientId: string
): NutritionExtrasCache | undefined {
  return getDashboardDayCache<NutritionExtrasCache>(
    nutritionExtrasCacheKey(clientId)
  );
}

export function setNutritionExtrasCache(
  clientId: string,
  data: NutritionExtrasCache
) {
  setDashboardDayCache(nutritionExtrasCacheKey(clientId), data);
}

export function progressPhotosSetsCacheKey(clientId: string) {
  return `${clientId}:progress-photos-sets`;
}

export function getProgressPhotosSetsCache(
  clientId: string
): ProgressPhotoSet[] | undefined {
  return getDashboardDayCache<ProgressPhotoSet[]>(
    progressPhotosSetsCacheKey(clientId)
  );
}

export function setProgressPhotosSetsCache(
  clientId: string,
  sets: ProgressPhotoSet[]
) {
  setDashboardDayCache(progressPhotosSetsCacheKey(clientId), sets);
}

export function progressPhotosUrlsCacheKey(clientId: string, monthKey: string) {
  return `${clientId}:progress-photos-urls:${monthKey}`;
}

export type ProgressPhotosUrlsCacheEntry = {
  urls: PoseUrls;
  pathsKey: string;
};

export function getProgressPhotosUrlsCache(
  clientId: string,
  monthKey: string
): ProgressPhotosUrlsCacheEntry | undefined {
  const entry = getDashboardDayCache<ProgressPhotosUrlsCacheEntry | PoseUrls>(
    progressPhotosUrlsCacheKey(clientId, monthKey)
  );
  if (!entry) return undefined;
  if ("urls" in entry && "pathsKey" in entry) return entry;
  return { urls: entry as PoseUrls, pathsKey: "" };
}

export function setProgressPhotosUrlsCache(
  clientId: string,
  monthKey: string,
  urls: PoseUrls,
  pathsKey: string
) {
  setDashboardDayCache(progressPhotosUrlsCacheKey(clientId, monthKey), {
    urls,
    pathsKey,
  });
}

export function isProgressPhotosSetsCacheFresh(clientId: string) {
  return isDashboardDayCacheFresh(progressPhotosSetsCacheKey(clientId));
}

export function isProgressPhotosUrlsCacheFresh(clientId: string, monthKey: string) {
  return isDashboardDayCacheFresh(progressPhotosUrlsCacheKey(clientId, monthKey));
}

export function isNutritionExtrasCacheFresh(clientId: string) {
  return isDashboardDayCacheFresh(nutritionExtrasCacheKey(clientId));
}
