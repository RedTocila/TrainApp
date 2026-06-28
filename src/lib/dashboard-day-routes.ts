export const DASHBOARD_DAY_NUTRITION_PATH = "/dashboard/day/nutrition";
export const DASHBOARD_DAY_WORKOUT_PATH = "/dashboard/day/workout";
export const DASHBOARD_PROGRESS_PHOTOS_PATH = "/dashboard/progress-photos";
export const DASHBOARD_HABITS_NEW_PATH = "/dashboard/habits/new";

export function dashboardDayWorkoutDetailPath(workoutKey: string) {
  return `${DASHBOARD_DAY_WORKOUT_PATH}#workout-${encodeURIComponent(workoutKey)}`;
}
