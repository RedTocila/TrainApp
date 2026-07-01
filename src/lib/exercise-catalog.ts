import catalog from "@/data/exercise-catalog.json";
import type { ExerciseGender } from "@/lib/exercise-gif";
import { EXERCISE_NAME_ALIASES } from "@/lib/exercise-name-aliases";

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
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-");
}

const STOP_WORDS = new Set([
  "the",
  "with",
  "and",
  "for",
  "male",
  "female",
  "style",
  "variation",
  "version",
  "v",
  "elite",
  "classic",
  "advanced",
  "assisted",
  "alternate",
  "alternative",
  "inverted",
  "extended",
  "extreme",
  "fixed",
  "horizontal",
  "vertical",
  "diagonal",
  "elevated",
  "pov",
  "attachment",
  "rope",
  "ball",
  "towel",
  "support",
  "pointed",
  "expanded",
  "active",
  "fierce",
  "pure",
  "controlled",
  "squared",
  "twin",
  "handle",
  "degrees",
  "motion",
]);

const EQUIPMENT_TOKENS = new Set([
  "band",
  "bands",
  "cable",
  "cables",
  "dumbbell",
  "dumbbells",
  "barbell",
  "kettlebell",
  "smith",
  "machine",
  "lever",
  "sled",
  "assisted",
  "weighted",
  "bodyweight",
]);

function tokenizeExerciseName(name: string): string[] {
  return normalizeExerciseName(name)
    .split(/[\s-]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function extractEquipmentTokens(tokens: string[]): Set<string> {
  return new Set(tokens.filter((token) => EQUIPMENT_TOKENS.has(token)));
}

function scoreCatalogNameMatch(query: string, catalogName: string): number {
  const normalizedQuery = normalizeExerciseName(query);
  const normalizedCatalog = normalizeExerciseName(catalogName);

  if (normalizedQuery === normalizedCatalog) return 1;

  const queryTokens = tokenizeExerciseName(query);
  const catalogTokens = tokenizeExerciseName(catalogName);
  if (queryTokens.length === 0 || catalogTokens.length === 0) return 0;

  const querySet = new Set(queryTokens);
  let shared = 0;
  for (const token of queryTokens) {
    if (catalogTokens.includes(token)) shared += 1;
  }

  const queryCoverage = shared / queryTokens.length;
  if (queryCoverage < 1) return 0;

  const extraCatalogTokens = catalogTokens.filter((token) => !querySet.has(token));
  const extraPenalty = Math.min(0.35, extraCatalogTokens.length * 0.06);

  const queryEquipment = extractEquipmentTokens(queryTokens);
  const catalogEquipment = extractEquipmentTokens(catalogTokens);
  let equipmentPenalty = 0;
  if (catalogEquipment.size > 0) {
    for (const equipment of catalogEquipment) {
      if (!queryEquipment.has(equipment)) {
        equipmentPenalty += 0.12;
      }
    }
  }

  const lengthPenalty =
    Math.max(0, catalogTokens.length - queryTokens.length) * 0.04;

  let score = 0.55 + queryCoverage * 0.35 - extraPenalty - equipmentPenalty - lengthPenalty;

  if (
    normalizedCatalog.startsWith(normalizedQuery) ||
    normalizedCatalog.endsWith(normalizedQuery)
  ) {
    score += 0.08;
  }

  if (normalizedQuery.includes(normalizedCatalog)) {
    score += 0.05;
  }

  return Math.max(0, Math.min(1, score));
}

function equipmentPreferenceScore(catalogName: string, query: string): number {
  const queryTokens = tokenizeExerciseName(query);
  const catalogTokens = tokenizeExerciseName(catalogName);
  const queryEquipment = extractEquipmentTokens(queryTokens);
  const catalogEquipment = extractEquipmentTokens(catalogTokens);

  if (queryEquipment.size > 0) {
    let matches = 0;
    for (const equipment of queryEquipment) {
      if (catalogEquipment.has(equipment)) matches += 1;
    }
    return matches / queryEquipment.size;
  }

  if (catalogEquipment.has("band")) return -0.25;
  if (catalogEquipment.has("cable")) return 0.05;
  if (catalogEquipment.has("dumbbell")) return 0.08;
  if (catalogEquipment.has("barbell")) return 0.12;
  if (catalogEquipment.size === 0) return 0.1;
  return 0;
}

const catalogByName = new Map<string, CatalogExercise>();
for (const exercise of data.exercises) {
  catalogByName.set(normalizeExerciseName(exercise.name), exercise);
}

export function getCatalogExercises(): CatalogExercise[] {
  return data.exercises;
}

export function findCatalogExercise(name: string): CatalogExercise | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const normalized = normalizeExerciseName(trimmed);
  const aliasTarget = EXERCISE_NAME_ALIASES[normalized];
  if (aliasTarget) {
    const aliased = catalogByName.get(normalizeExerciseName(aliasTarget));
    if (aliased) return aliased;
  }

  const exact = catalogByName.get(normalized);
  if (exact) return exact;

  let best: CatalogExercise | null = null;
  let bestScore = 0.62;

  for (const [catalogName, exercise] of catalogByName) {
    const score = scoreCatalogNameMatch(trimmed, catalogName);
    if (score <= 0) continue;

    const adjusted = score + equipmentPreferenceScore(catalogName, trimmed);
    if (adjusted > bestScore) {
      bestScore = adjusted;
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
