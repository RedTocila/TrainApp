import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";
import type { DailyMealLog } from "@/lib/types";

export interface DashboardLivePatch {
  dateKey: string;
  taskId?: string;
  completed?: boolean;
  waterMl?: number;
  workoutCompleted?: boolean;
  workoutSessionId?: string;
  dailyMeals?: DailyMealLog[];
}

export interface DashboardPatchState {
  completions: Record<string, Record<string, boolean>>;
  water: Record<string, number>;
  workoutCompleted: Record<string, boolean>;
  workoutSessionIds: Record<string, string>;
  meals: Record<string, DailyMealLog[]>;
}

export function emptyPatchState(): DashboardPatchState {
  return {
    completions: {},
    water: {},
    workoutCompleted: {},
    workoutSessionIds: {},
    meals: {},
  };
}

export function applyLivePatch(
  state: DashboardPatchState,
  patch: DashboardLivePatch
): DashboardPatchState {
  const next: DashboardPatchState = {
    completions: { ...state.completions },
    water: { ...state.water },
    workoutCompleted: { ...state.workoutCompleted },
    workoutSessionIds: { ...state.workoutSessionIds },
    meals: { ...state.meals },
  };

  if (patch.taskId !== undefined && patch.completed !== undefined) {
    const dateCompletions = { ...(next.completions[patch.dateKey] ?? {}) };
    dateCompletions[patch.taskId] = patch.completed;
    next.completions[patch.dateKey] = dateCompletions;
  }

  if (patch.waterMl !== undefined) {
    next.water[patch.dateKey] = patch.waterMl;
  }

  if (patch.workoutCompleted !== undefined) {
    next.workoutCompleted[patch.dateKey] = patch.workoutCompleted;
  }

  if (patch.workoutSessionId !== undefined) {
    const sessionKey = patch.taskId ?? patch.dateKey;
    next.workoutSessionIds[sessionKey] = patch.workoutSessionId;
  }

  if (patch.dailyMeals !== undefined) {
    next.meals[patch.dateKey] = patch.dailyMeals;
  }

  return next;
}

export function isWorkoutCompletedFromPatches(
  patches: DashboardPatchState,
  dateKey: string
): boolean {
  if (patches.workoutCompleted[dateKey]) return true;
  const taskId = `${dateKey}-workout`;
  return patches.completions[dateKey]?.[taskId] === true;
}

export function mergeEnrichmentWithPatches(
  data: DashboardEnrichmentData,
  patches: DashboardPatchState
): DashboardEnrichmentData {
  const completionsByDate = { ...data.completionsByDate };
  for (const [dateKey, tasks] of Object.entries(patches.completions)) {
    const set = new Set(completionsByDate[dateKey] ?? []);
    for (const [taskId, completed] of Object.entries(tasks)) {
      if (completed) set.add(taskId);
      else set.delete(taskId);
    }
    completionsByDate[dateKey] = [...set];
  }

  const waterByDate = { ...data.waterByDate, ...patches.water };
  const mealsByDate = { ...data.mealsByDate, ...patches.meals };

  const workoutSet = new Set(data.workoutCompletedDates);
  for (const [dateKey, completed] of Object.entries(patches.workoutCompleted)) {
    if (completed) workoutSet.add(dateKey);
    else workoutSet.delete(dateKey);
  }

  return {
    ...data,
    completionsByDate,
    waterByDate,
    mealsByDate,
    workoutCompletedDates: [...workoutSet],
  };
}

export function mergeCompletionMaps(
  ...maps: Record<string, Set<string>>[]
): Record<string, string[]> {
  const merged: Record<string, Set<string>> = {};

  for (const map of maps) {
    for (const [date, ids] of Object.entries(map)) {
      if (!merged[date]) merged[date] = new Set();
      for (const id of ids) merged[date].add(id);
    }
  }

  const out: Record<string, string[]> = {};
  for (const [date, ids] of Object.entries(merged)) {
    out[date] = [...ids];
  }
  return out;
}

export function mergeWorkoutTaskCompletionsInto(
  completionsByDate: Record<string, string[]>,
  workoutTaskCompletions: Record<string, Set<string>>
): Record<string, string[]> {
  const merged = { ...completionsByDate };

  for (const [date, taskIds] of Object.entries(workoutTaskCompletions)) {
    const set = new Set(merged[date] ?? []);
    for (const taskId of taskIds) set.add(taskId);
    merged[date] = [...set];
  }

  return merged;
}
