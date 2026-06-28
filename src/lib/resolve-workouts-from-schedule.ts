import type { ClientSchedule } from "@/lib/daily-tasks";
import type { Exercise } from "@/lib/types";
import { workoutTaskId } from "@/lib/workout-task-id";
import { formatDateKey } from "@/lib/utils";
import type { TodaysWorkoutInfo } from "@/lib/actions/workout-sessions";

function mapScheduledDayToWorkout(
  entry: NonNullable<ClientSchedule["scheduledWorkouts"]>[number],
  dateKey: string
): TodaysWorkoutInfo | null {
  if (!entry.workout_days || !entry.plan_id) return null;
  const day = entry.workout_days;
  const exercises = (day.exercises ?? []).sort(
    (a: Exercise, b: Exercise) => a.order_index - b.order_index
  );
  return {
    planId: entry.plan_id,
    dayId: day.id,
    planTitle: entry.workout_plans?.title ?? "Workout",
    dayTitle: day.title,
    scheduledDate: dateKey,
    scheduledWorkoutId: entry.id,
    taskId: workoutTaskId(dateKey, entry.id),
    exercises: exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      notes: ex.notes,
    })),
  };
}

/** Client-side workout list from dashboard schedule — instant when browsing calendar days. */
export function resolveWorkoutsFromSchedule(
  date: Date,
  schedule: ClientSchedule
): TodaysWorkoutInfo[] {
  const dateKey = formatDateKey(date);
  const scheduled = (schedule.scheduledWorkouts ?? [])
    .filter((entry) => entry.scheduled_date === dateKey && entry.workout_days)
    .sort(
      (a, b) =>
        (a.order_index ?? 0) - (b.order_index ?? 0) ||
        a.created_at.localeCompare(b.created_at)
    );

  if (scheduled.length > 0) {
    return scheduled
      .map((entry) => mapScheduledDayToWorkout(entry, dateKey))
      .filter((entry): entry is TodaysWorkoutInfo => entry != null);
  }

  const assignment = schedule.workoutAssignment;
  const days =
    assignment?.workout_plans?.workout_days?.sort(
      (a, b) => a.day_index - b.day_index
    ) ?? [];
  if (days.length === 0 || !assignment?.plan_id) return [];

  const day = days[date.getDay() % days.length];
  const exercises = (day.exercises ?? []).sort(
    (a: Exercise, b: Exercise) => a.order_index - b.order_index
  );

  return [
    {
      planId: assignment.plan_id,
      dayId: day.id,
      planTitle: assignment.workout_plans?.title ?? "Workout",
      dayTitle: day.title,
      scheduledDate: null,
      scheduledWorkoutId: null,
      taskId: workoutTaskId(dateKey, null),
      exercises: exercises.map((ex) => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        notes: ex.notes,
      })),
    },
  ];
}

export function workoutCompletionFromEnrichment(
  workouts: TodaysWorkoutInfo[],
  completedTaskIds: string[] | undefined
): Record<string, boolean> {
  const completed = new Set(completedTaskIds ?? []);
  return Object.fromEntries(
    workouts.map((workout) => [workout.taskId, completed.has(workout.taskId)])
  );
}
