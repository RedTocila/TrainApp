import {
  enrichExercisesWithGifs,
  resolveProfileGender,
  type ExerciseGender,
} from "@/lib/exercise-gif";
import {
  canonicalizeAiExerciseName,
  findCatalogExercise,
} from "@/lib/exercise-catalog";

export type { ExerciseGender };

export async function enrichExercisesWithDemoVideos<
  T extends { name: string; image_url?: string | null; video_url?: string },
>(exercises: T[], gender?: string | null): Promise<T[]> {
  const resolvedGender = resolveProfileGender(gender);
  const withCatalogNames = exercises.map((exercise) => {
    const catalogName = canonicalizeAiExerciseName(exercise.name);
    if (catalogName === exercise.name) return exercise;
    return { ...exercise, name: catalogName };
  });
  return enrichExercisesWithGifs(withCatalogNames, resolvedGender);
}

export function lookupCatalogExerciseName(exerciseName: string): string | null {
  const name = exerciseName.trim();
  if (!name) return null;
  return findCatalogExercise(name)?.name ?? null;
}
