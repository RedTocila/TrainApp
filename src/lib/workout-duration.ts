const WORK_SECONDS_PER_SET = 45;
const DEFAULT_REST_SECONDS = 90;
const TRANSITION_SECONDS = 60;

export type WorkoutDurationExercise = {
  target_sets: number;
  rest_seconds?: number | null;
};

export function estimateWorkoutDurationSeconds(
  exercises: WorkoutDurationExercise[]
): number {
  if (exercises.length === 0) return 0;

  let total = 0;
  for (const exercise of exercises) {
    const rest = exercise.rest_seconds ?? DEFAULT_REST_SECONDS;
    total += exercise.target_sets * (WORK_SECONDS_PER_SET + rest);
  }
  total += (exercises.length - 1) * TRANSITION_SECONDS;
  return total;
}

export function formatElapsedClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatWorkoutDurationShort(totalSeconds: number): string {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function getWorkoutSetStats(
  exercises: {
    target_sets: number;
    sets?: { reps: number | null; weight_kg: number | null; completed: boolean }[];
  }[]
) {
  const totalSets = exercises.reduce(
    (sum, exercise) => sum + (exercise.sets?.length ?? exercise.target_sets),
    0
  );
  const loggedSets = exercises.reduce((sum, exercise) => {
    return (
      sum +
      (exercise.sets ?? []).filter(
        (set) => set.reps != null || set.weight_kg != null || set.completed
      ).length
    );
  }, 0);

  return {
    exerciseCount: exercises.length,
    totalSets,
    loggedSets,
  };
}
