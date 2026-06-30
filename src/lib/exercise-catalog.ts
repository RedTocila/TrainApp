import catalog from "@/data/exercise-catalog.json";
import type { ExerciseGender } from "@/lib/exercise-gif";

export interface CatalogExerciseGifs {
  male?: string;
  female?: string;
}

export interface CatalogExercise {
  id: string;
  name: string;
  category: string;
  body_parts: string[];
  equipment: string[];
  primary_muscles: string[];
  secondary_muscles: string[];
  description: string | null;
  instructions: string[];
  gif_url: string | null;
  gif_fallback_url?: string | null;
  gifs: CatalogExerciseGifs;
  video_url?: string | null;
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

function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ");
}

function tokenizeExerciseName(name: string): string[] {
  return normalizeExerciseName(name)
    .split(" ")
    .filter((token) => token.length > 2);
}

function scoreCatalogNameMatch(query: string, catalogName: string): number {
  const normalizedQuery = normalizeExerciseName(query);
  const normalizedCatalog = normalizeExerciseName(catalogName);

  if (normalizedQuery === normalizedCatalog) return 1;

  if (
    normalizedCatalog.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedCatalog)
  ) {
    const overlap = Math.min(normalizedQuery.length, normalizedCatalog.length);
    const maxLen = Math.max(normalizedQuery.length, normalizedCatalog.length);
    return 0.75 + (overlap / maxLen) * 0.2;
  }

  const queryTokens = tokenizeExerciseName(query);
  const catalogTokens = tokenizeExerciseName(catalogName);
  if (queryTokens.length === 0 || catalogTokens.length === 0) return 0;

  let shared = 0;
  for (const token of queryTokens) {
    if (catalogTokens.includes(token)) shared += 1;
  }

  return shared / queryTokens.length;
}

const catalogByName = new Map<string, CatalogExercise>();
for (const exercise of data.exercises) {
  catalogByName.set(normalizeExerciseName(exercise.name), exercise);
}

export function getCatalogExercises(): CatalogExercise[] {
  return data.exercises;
}

export function findCatalogExercise(name: string): CatalogExercise | null {
  const normalized = normalizeExerciseName(name);
  const exact = catalogByName.get(normalized);
  if (exact) return exact;

  let best: CatalogExercise | null = null;
  let bestScore = 0.5;

  for (const [catalogName, exercise] of catalogByName) {
    const score = scoreCatalogNameMatch(name, catalogName);
    if (score > bestScore) {
      bestScore = score;
      best = exercise;
    }
  }

  return best;
}

export function getCatalogGifUrl(
  exercise: CatalogExercise,
  gender?: ExerciseGender | null
): string | null {
  return getCatalogGifUrls(exercise, gender).url;
}

export function getCatalogGifUrls(
  exercise: CatalogExercise,
  gender?: ExerciseGender | null
): { url: string | null; fallbackUrl: string | null } {
  const genderUrl =
    gender === "male"
      ? exercise.gifs.male
      : gender === "female"
        ? exercise.gifs.female
        : null;

  const url =
    genderUrl ??
    exercise.gif_url ??
    exercise.gifs.male ??
    exercise.gifs.female ??
    exercise.gif_fallback_url ??
    null;

  const fallbackUrl =
    exercise.gif_fallback_url &&
    exercise.gif_fallback_url !== url
      ? exercise.gif_fallback_url
      : null;

  return { url, fallbackUrl };
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
    if (category && ex.category !== category && !ex.body_parts.includes(category)) {
      return false;
    }
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
      ...ex.body_parts,
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
