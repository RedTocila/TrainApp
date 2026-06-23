import type { DashboardEnrichmentData } from "@/lib/dashboard-task-enrichment";

export interface DashboardLivePatch {
  dateKey: string;
  taskId?: string;
  completed?: boolean;
  waterMl?: number;
  workoutCompleted?: boolean;
}

export interface DashboardPatchState {
  completions: Record<string, Record<string, boolean>>;
  water: Record<string, number>;
  workoutCompleted: Record<string, boolean>;
}

export function emptyPatchState(): DashboardPatchState {
  return { completions: {}, water: {}, workoutCompleted: {} };
}

export function applyLivePatch(
  state: DashboardPatchState,
  patch: DashboardLivePatch
): DashboardPatchState {
  const next: DashboardPatchState = {
    completions: { ...state.completions },
    water: { ...state.water },
    workoutCompleted: { ...state.workoutCompleted },
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

  return next;
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

  const workoutSet = new Set(data.workoutCompletedDates);
  for (const [dateKey, completed] of Object.entries(patches.workoutCompleted)) {
    if (completed) workoutSet.add(dateKey);
    else workoutSet.delete(dateKey);
  }

  return {
    ...data,
    completionsByDate,
    waterByDate,
    workoutCompletedDates: [...workoutSet],
  };
}
