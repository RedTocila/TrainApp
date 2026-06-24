import catalog from "@/data/exercise-catalog.json";

export interface CatalogExercise {
  name: string;
  category: string;
  equipment: string[];
  primary_muscles: string[];
  secondary_muscles: string[];
  description: string | null;
  instructions: string[];
  video: string | null;
}

export interface ExerciseCatalog {
  source: string;
  attribution: string;
  categories: string[];
  equipment: string[];
  muscles: string[];
  muscle_groups: Record<string, string[]>;
  exercises: CatalogExercise[];
}

const data = catalog as ExerciseCatalog;

export const EXERCISE_CATALOG = data;

export function getCatalogExercises(): CatalogExercise[] {
  return data.exercises;
}

export function searchCatalogExercises({
  query = "",
  category,
  muscle,
  equipment,
}: {
  query?: string;
  category?: string;
  muscle?: string;
  equipment?: string;
}): CatalogExercise[] {
  const q = query.trim().toLowerCase();

  return data.exercises.filter((ex) => {
    if (category && ex.category !== category) return false;
    if (equipment && !ex.equipment.includes(equipment)) return false;
    if (
      muscle &&
      !ex.primary_muscles.includes(muscle) &&
      !ex.secondary_muscles.includes(muscle)
    ) {
      return false;
    }
    if (!q) return true;

    const haystack = [
      ex.name,
      ex.category,
      ex.description ?? "",
      ...ex.equipment,
      ...ex.primary_muscles,
      ...ex.secondary_muscles,
      ...ex.instructions,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function formatCatalogLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
