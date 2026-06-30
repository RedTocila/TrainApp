import {
  enrichExercisesWithGifs,
  resolveProfileGender,
  type ExerciseGender,
} from "@/lib/exercise-gif";
import { findCatalogExercise } from "@/lib/exercise-catalog";

export type { ExerciseGender };

export async function enrichExercisesWithDemoVideos<
  T extends { name: string; image_url?: string | null; video_url?: string },
>(exercises: T[], gender?: string | null): Promise<T[]> {
  const resolvedGender = resolveProfileGender(gender);
  return enrichExercisesWithGifs(exercises, resolvedGender);
}

export function lookupCatalogExerciseName(exerciseName: string): string | null {
  const name = exerciseName.trim();
  if (!name) return null;
  return findCatalogExercise(name)?.name ?? null;
}
