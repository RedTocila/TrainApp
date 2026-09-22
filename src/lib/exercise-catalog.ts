import catalog from "@/data/exercise-catalog.json";
import type { ExerciseGender } from "@/lib/exercise-gif";
import { toExerciseGifProxyUrl } from "@/lib/exercise-gif-proxy";
import {
  BODYWEIGHT_EXERCISE_ALIASES,
  EXERCISE_NAME_ALIASES,
} from "@/lib/exercise-name-aliases";
import {
  CATALOG_EQUIPMENT,
  exerciseAllowedByConstraint,
  type EquipmentConstraint,
} from "@/lib/ai/equipment-taxonomy";

export type CanonicalizeOptions = {
  /** When set, only match exercises allowed by this equipment constraint. */
  equipment?: EquipmentConstraint | null;
};

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

/** Light stemming so AI plurals / short forms still hit catalog names. */
function stemExerciseToken(token: string): string {
  if (token === "triceps" || token === "tricep") return "tricep";
  if (token === "biceps" || token === "bicep") return "bicep";
  if (token === "raises") return "raise";
  if (token === "rows") return "row";
  if (token === "curls") return "curl";
  if (token === "presses") return "press";
  if (token === "extensions") return "extension";
  if (token === "flies" || token === "flyes" || token === "flys") return "fly";
  if (token === "lunges") return "lunge";
  if (token === "squats") return "squat";
  if (token === "deadlifts") return "deadlift";
  if (token === "pulldowns") return "pulldown";
  if (token === "pushups" || token === "pushup") return "pushup";
  if (token === "pullups" || token === "pullup") return "pullup";
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ses") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
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
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map(stemExerciseToken);
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
  // Short queries must match every token; longer ones may miss one (plurals / wording).
  if (queryTokens.length <= 3) {
    if (shared < queryTokens.length) return 0;
  } else if (queryCoverage < 0.75 && shared < queryTokens.length - 1) {
    return 0;
  }

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

function equipmentPreferenceScore(
  catalogName: string,
  query: string,
  preferBodyweight = false
): number {
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

  if (preferBodyweight) {
    if (
      catalogEquipment.size === 0 ||
      (catalogEquipment.size === 1 && catalogEquipment.has("bodyweight"))
    ) {
      return 0.2;
    }
    if (catalogEquipment.has("barbell")) return -0.2;
    if (catalogEquipment.has("cable")) return -0.15;
    if (catalogEquipment.has("dumbbell")) return -0.1;
    return 0;
  }

  if (catalogEquipment.has("band")) return -0.25;
  if (catalogEquipment.has("cable")) return 0.05;
  if (catalogEquipment.has("dumbbell")) return 0.08;
  if (catalogEquipment.has("barbell")) return 0.12;
  if (catalogEquipment.size === 0) return 0.1;
  return 0;
}

function prefersBodyweightMatching(
  equipment?: EquipmentConstraint | null
): boolean {
  if (!equipment?.allowedTags) return false;
  return (
    equipment.allowedTags.size === 1 &&
    equipment.allowedTags.has(CATALOG_EQUIPMENT.BODY_WEIGHT)
  );
}

function resolveAliasTarget(
  normalizedQuery: string,
  equipment?: EquipmentConstraint | null
): string | undefined {
  const bodyweightAlias = BODYWEIGHT_EXERCISE_ALIASES[normalizedQuery];
  const gymAlias = EXERCISE_NAME_ALIASES[normalizedQuery];

  if (prefersBodyweightMatching(equipment) && bodyweightAlias) {
    return bodyweightAlias;
  }

  if (gymAlias && equipment?.allowedTags) {
    const gymTarget = catalogByName.get(normalizeExerciseName(gymAlias));
    if (gymTarget && exerciseAllowedByConstraint(gymTarget, equipment)) {
      return gymAlias;
    }
    if (bodyweightAlias) return bodyweightAlias;
    return undefined;
  }

  return gymAlias;
}

function isAllowedExercise(
  exercise: CatalogExercise,
  equipment?: EquipmentConstraint | null
): boolean {
  if (!equipment?.allowedTags) return true;
  return exerciseAllowedByConstraint(exercise, equipment);
}

const catalogByName = new Map<string, CatalogExercise>();
for (const exercise of data.exercises) {
  catalogByName.set(normalizeExerciseName(exercise.name), exercise);
}

export function getCatalogExercises(): CatalogExercise[] {
  return data.exercises;
}

export function findCatalogExercise(
  name: string,
  options?: CanonicalizeOptions
): CatalogExercise | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const equipment = options?.equipment ?? null;
  const preferBw = prefersBodyweightMatching(equipment);
  const normalized = normalizeExerciseName(trimmed);

  const aliasTarget = resolveAliasTarget(normalized, equipment);
  if (aliasTarget) {
    const aliased = catalogByName.get(normalizeExerciseName(aliasTarget));
    if (aliased && isAllowedExercise(aliased, equipment)) return aliased;
  }

  const exact = catalogByName.get(normalized);
  if (exact && isAllowedExercise(exact, equipment)) return exact;

  let best: CatalogExercise | null = null;
  let bestScore = 0.55;

  for (const [catalogName, exercise] of catalogByName) {
    if (!isAllowedExercise(exercise, equipment)) continue;
    const score = scoreCatalogNameMatch(trimmed, catalogName);
    if (score <= 0) continue;

    const adjusted =
      score + equipmentPreferenceScore(catalogName, trimmed, preferBw);
    if (adjusted > bestScore) {
      bestScore = adjusted;
      best = exercise;
    }
  }

  return best;
}

/**
 * Rewrite an AI / free-form exercise name to the nearest catalog canonical name
 * so GIF / video demos resolve. Falls back to the original if nothing matches.
 * When `options.equipment` is set, never remaps to a disallowed equipment exercise.
 */
export function canonicalizeAiExerciseName(
  name: string,
  options?: CanonicalizeOptions
): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const equipment = options?.equipment ?? null;
  const preferBw = prefersBodyweightMatching(equipment);

  const direct = findCatalogExercise(trimmed, options);
  if (direct) return direct.name;

  // Last resort: pick the top search hit when tokens overlap enough.
  const tokens = tokenizeExerciseName(trimmed).slice(0, 4);
  if (tokens.length === 0) return trimmed;

  const candidates = searchCatalogExercises({
    query: tokens.join(" "),
    equipmentConstraint: equipment,
  }).slice(0, 40);
  let best: CatalogExercise | null = null;
  let bestScore = 0.72;
  for (const exercise of candidates) {
    const score =
      scoreCatalogNameMatch(trimmed, exercise.name) +
      equipmentPreferenceScore(exercise.name, trimmed, preferBw);
    if (score > bestScore) {
      bestScore = score;
      best = exercise;
    }
  }

  return best?.name ?? trimmed;
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

  return {
    url: toExerciseGifProxyUrl(url),
    fallbackUrl: toExerciseGifProxyUrl(fallbackUrl),
  };
}

export function searchCatalogExercises({
  query = "",
  category,
  muscle,
  equipment,
  equipmentConstraint,
}: {
  query?: string;
  category?: string;
  muscle?: string;
  /** Exact catalog equipment tag (legacy single-tag filter). */
  equipment?: string;
  /** Full equipment constraint allowlist (preferred for AI generation). */
  equipmentConstraint?: EquipmentConstraint | null;
}): CatalogExercise[] {
  const q = query.trim().toLowerCase();

  return data.exercises.filter((ex) => {
    if (equipmentConstraint?.allowedTags) {
      if (!exerciseAllowedByConstraint(ex, equipmentConstraint)) return false;
    }
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
