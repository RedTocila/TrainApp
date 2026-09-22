import {
  enrichExercisesWithGifs,
  resolveProfileGender,
  type ExerciseGender,
} from "@/lib/exercise-gif";
import {
  canonicalizeAiExerciseName,
  findCatalogExercise,
} from "@/lib/exercise-catalog";
import type { EquipmentConstraint } from "@/lib/ai/equipment-taxonomy";

export type { ExerciseGender };

export async function enrichExercisesWithDemoVideos<
  T extends { name: string; image_url?: string | null; video_url?: string },
>(
  exercises: T[],
  gender?: string | null,
  equipment?: EquipmentConstraint | null
): Promise<T[]> {
  const resolvedGender = resolveProfileGender(gender);
  const withCatalogNames = exercises.map((exercise) => {
    const catalogName = canonicalizeAiExerciseName(exercise.name, {
      equipment: equipment ?? null,
    });
    if (catalogName === exercise.name) return exercise;
    return { ...exercise, name: catalogName };
  });
  return enrichExercisesWithGifs(withCatalogNames, resolvedGender);
}

export function lookupCatalogExerciseName(
  exerciseName: string,
  equipment?: EquipmentConstraint | null
): string | null {
  const name = exerciseName.trim();
  if (!name) return null;
  return findCatalogExercise(name, { equipment: equipment ?? null })?.name ?? null;
}
