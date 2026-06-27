import {
  getCatalogExercises,
  type CatalogExercise,
} from "@/lib/exercise-catalog";
import { inferWorkoutCategoryFromText } from "@/lib/workout-visual-categories";

export type BodyMuscleSlug =
  | "abs"
  | "adductors"
  | "biceps"
  | "calves"
  | "chest"
  | "deltoids"
  | "forearm"
  | "gluteal"
  | "hamstring"
  | "lower-back"
  | "neck"
  | "obliques"
  | "quadriceps"
  | "trapezius"
  | "triceps"
  | "upper-back";

const CATALOG_MUSCLE_TO_SLUG: Record<string, BodyMuscleSlug> = {
  chest: "chest",
  biceps: "biceps",
  triceps: "triceps",
  shoulders: "deltoids",
  abs: "abs",
  obliques: "obliques",
  quads: "quadriceps",
  hamstrings: "hamstring",
  glutes: "gluteal",
  calves: "calves",
  lats: "upper-back",
  "middle back": "upper-back",
  "lower back": "lower-back",
  traps: "trapezius",
  forearms: "forearm",
  neck: "neck",
  abductors: "adductors",
  adductors: "adductors",
  brachialis: "biceps",
  soleus: "calves",
  "serratus anterior": "chest",
};

const CATEGORY_FALLBACK_SLUGS: Record<string, BodyMuscleSlug[]> = {
  push: ["chest", "deltoids", "triceps"],
  pull: ["upper-back", "biceps", "trapezius", "forearm"],
  legs: ["quadriceps", "hamstring", "gluteal", "calves"],
  core: ["abs", "obliques"],
  upper: ["chest", "deltoids", "upper-back", "biceps", "triceps"],
  full: [
    "chest",
    "deltoids",
    "upper-back",
    "quadriceps",
    "hamstring",
    "gluteal",
    "abs",
  ],
};

function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ");
}

const catalogByName = new Map<string, CatalogExercise>();
for (const exercise of getCatalogExercises()) {
  catalogByName.set(normalizeExerciseName(exercise.name), exercise);
}

function findCatalogExercise(name: string): CatalogExercise | null {
  const normalized = normalizeExerciseName(name);
  const exact = catalogByName.get(normalized);
  if (exact) return exact;

  let best: CatalogExercise | null = null;
  let bestScore = 0;

  for (const [catalogName, exercise] of catalogByName) {
    if (catalogName === normalized) return exercise;
    if (catalogName.includes(normalized) || normalized.includes(catalogName)) {
      const score = Math.min(catalogName.length, normalized.length);
      if (score > bestScore) {
        bestScore = score;
        best = exercise;
      }
    }
  }

  return best;
}

function catalogMusclesToSlugs(muscles: string[]): BodyMuscleSlug[] {
  const slugs = new Set<BodyMuscleSlug>();
  for (const muscle of muscles) {
    const slug = CATALOG_MUSCLE_TO_SLUG[muscle.toLowerCase()];
    if (slug) slugs.add(slug);
  }
  return [...slugs];
}

export function resolveWorkoutMuscleSlugs(
  exercises: { name: string }[],
  dayTitle?: string
): BodyMuscleSlug[] {
  const slugs = new Set<BodyMuscleSlug>();
  let matchedFromCatalog = 0;

  for (const exercise of exercises) {
    const catalogEntry = findCatalogExercise(exercise.name);
    if (!catalogEntry) continue;
    matchedFromCatalog += 1;
    for (const slug of catalogMusclesToSlugs(catalogEntry.primary_muscles)) {
      slugs.add(slug);
    }
    for (const slug of catalogMusclesToSlugs(catalogEntry.secondary_muscles)) {
      slugs.add(slug);
    }
  }

  if (slugs.size > 0) return [...slugs];

  const category = inferWorkoutCategoryFromText(
    dayTitle,
    ...exercises.map((exercise) => exercise.name)
  );
  const fallback = CATEGORY_FALLBACK_SLUGS[category];
  if (fallback?.length) return fallback;

  if (matchedFromCatalog === 0 && exercises.length > 0) {
    return CATEGORY_FALLBACK_SLUGS.full;
  }

  return [];
}

export function toBodyHighlighterData(
  slugs: BodyMuscleSlug[]
): { slug: BodyMuscleSlug; intensity: number }[] {
  return slugs.map((slug) => ({ slug, intensity: 2 }));
}

export function resolveBodyMapGender(
  gender: string | null | undefined
): "male" | "female" {
  return gender === "female" ? "female" : "male";
}
