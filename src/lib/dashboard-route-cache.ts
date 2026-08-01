import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import type { MealPlanViewKind } from "@/lib/actions/user-nutrition-schedule";
import type { CompletedWorkoutResults, TodaysWorkoutInfo } from "@/lib/actions/workout-sessions";
import {
  dashboardDayCacheKey,
  deleteDashboardDayCache,
  getDashboardDayCache,
  isDashboardDayCacheFresh,
  setDashboardDayCache,
} from "@/lib/dashboard-day-cache";
import type { Meal, MealSlot, ProgressPhotoSet, DailyLog, DailyMealLog } from "@/lib/types";
import type { ProgressPhotoPose } from "@/lib/supabase/storage";

export type WorkoutDayCache = {
  workouts: TodaysWorkoutInfo[];
  completedByTaskId: Record<string, boolean>;
  skippedByTaskId?: Record<string, boolean>;
  sessionIdByTaskId?: Record<string, string | null>;
  allCompleted: boolean;
  results: CompletedWorkoutResults | null;
};

export type NutritionExtrasCache = {
  mealLibrary: PersonalMealLibraryItem[];
  personalPlanId: string | null;
  nutritionPlan: {
    title: string;
    meals: Meal[];
    scheduled?: boolean;
    activeSlots?: MealSlot[];
    kind?: MealPlanViewKind;
  } | null;
};

/** Shared shape for the client `overview` day cache (dashboard + nutrition). */
export type OverviewDayCache = {
  log: DailyLog | null;
  dailyMeals: DailyMealLog[];
  nutritionPlan: {
    title: string;
    meals: Meal[];
    scheduled?: boolean;
    activeSlots?: MealSlot[];
    kind?: MealPlanViewKind;
    planId?: string;
  } | null;
};

export type PoseUrls = Record<ProgressPhotoPose, string | null>;

export function workoutDayCacheKey(clientId: string, dateKey: string) {
  return dashboardDayCacheKey(clientId, "workout-day", dateKey);
}

export function overviewDayCacheKey(clientId: string, dateKey: string) {
  return dashboardDayCacheKey(clientId, "overview", dateKey);
}

export function getOverviewDayCache(
  clientId: string,
  dateKey: string
): OverviewDayCache | undefined {
  return getDashboardDayCache<OverviewDayCache>(
    overviewDayCacheKey(clientId, dateKey)
  );
}

/** Keep the shared overview cache in sync after meal/water mutations. */
export function patchOverviewDayCache(
  clientId: string,
  dateKey: string,
  patch: {
    dailyMeals?: DailyMealLog[];
    waterMl?: number;
    log?: DailyLog | null;
    nutritionPlan?: OverviewDayCache["nutritionPlan"];
  }
) {
  const key = overviewDayCacheKey(clientId, dateKey);
  const current = getDashboardDayCache<OverviewDayCache>(key);
  let log = patch.log !== undefined ? patch.log : (current?.log ?? null);

  if (patch.waterMl !== undefined) {
    log = log
      ? { ...log, water_ml: patch.waterMl }
      : {
          id: "",
          client_id: clientId,
          date: dateKey,
          water_ml: patch.waterMl,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        };
  }

  setDashboardDayCache(key, {
    log,
    dailyMeals: patch.dailyMeals ?? current?.dailyMeals ?? [],
    nutritionPlan:
      patch.nutritionPlan !== undefined
        ? patch.nutritionPlan
        : (current?.nutritionPlan ?? null),
  } satisfies OverviewDayCache);
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

export function clearWorkoutDayCache(clientId: string, dateKey: string) {
  deleteDashboardDayCache(workoutDayCacheKey(clientId, dateKey));
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
