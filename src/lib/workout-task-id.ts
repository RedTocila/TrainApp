export function workoutTaskId(
  dateKey: string,
  scheduledWorkoutId?: string | null
): string {
  if (scheduledWorkoutId) {
    return `${dateKey}-workout-${scheduledWorkoutId}`;
  }
  return `${dateKey}-workout`;
}

export function isWorkoutTaskId(taskId: string): boolean {
  return taskId.includes("-workout");
}
