import {
  findCatalogExercise,
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

export type MuscleIntensity = 1 | 2 | 3;

/** Orange — secondary target (40–75%). */
export const INTENSITY_MODERATE_LOAD = 1 as const;
/** Red — primary target (75–100%). */
export const INTENSITY_PRIMARY_FOCUS = 2 as const;
/** Light gray — supporting muscle (10–40%). */
export const INTENSITY_SUPPORTING = 3 as const;

const INTENSITY_PRIORITY: Record<MuscleIntensity, number> = {
  [INTENSITY_SUPPORTING]: 1,
  [INTENSITY_MODERATE_LOAD]: 2,
  [INTENSITY_PRIMARY_FOCUS]: 3,
};

export interface WorkoutMuscleHighlight {
  slug: BodyMuscleSlug;
  intensity: MuscleIntensity;
}

const CATALOG_MUSCLE_TO_SLUG: Record<string, BodyMuscleSlug> = {
  chest: "chest",
  pectorals: "chest",
  "pectoralis major": "chest",
  biceps: "biceps",
  triceps: "triceps",
  "triceps brachii": "triceps",
  shoulders: "deltoids",
  deltoids: "deltoids",
  "rear deltoids": "deltoids",
  "deltoid anterior": "deltoids",
  "deltoid posterior": "deltoids",
  "anterior deltoid": "deltoids",
  "posterior deltoid": "deltoids",
  abs: "abs",
  core: "abs",
  obliques: "obliques",
  quads: "quadriceps",
  quadriceps: "quadriceps",
  hamstrings: "hamstring",
  hamstring: "hamstring",
  glutes: "gluteal",
  gluteal: "gluteal",
  calves: "calves",
  calf: "calves",
  lats: "upper-back",
  latissimus: "upper-back",
  "middle back": "upper-back",
  "upper back": "upper-back",
  rhomboids: "upper-back",
  "lower back": "lower-back",
  erector: "lower-back",
  spine: "lower-back",
  traps: "trapezius",
  trapezius: "trapezius",
  forearms: "forearm",
  forearm: "forearm",
  neck: "neck",
  abductors: "adductors",
  adductors: "adductors",
  brachialis: "biceps",
  soleus: "calves",
  gastrocnemius: "calves",
  "serratus anterior": "chest",
  "hip flexors": "quadriceps",
  "gluteus maximus": "gluteal",
};

/** Secondary muscles that meaningfully share load with a given primary mover. */
const SIGNIFICANT_SYNERGISTS: Partial<
  Record<BodyMuscleSlug, ReadonlySet<BodyMuscleSlug>>
> = {
  chest: new Set(["triceps", "deltoids"]),
  triceps: new Set(["deltoids", "chest"]),
  deltoids: new Set(["triceps", "chest", "upper-back"]),
  "upper-back": new Set(["biceps", "trapezius", "deltoids"]),
  biceps: new Set(["forearm"]),
  quadriceps: new Set(["gluteal", "hamstring"]),
  hamstring: new Set(["gluteal", "lower-back"]),
  gluteal: new Set(["hamstring", "lower-back", "quadriceps"]),
  abs: new Set(["obliques"]),
  obliques: new Set(["abs"]),
  "lower-back": new Set(["gluteal", "hamstring", "trapezius"]),
  trapezius: new Set(["upper-back", "deltoids"]),
  calves: new Set(["hamstring"]),
  adductors: new Set(["quadriceps", "gluteal"]),
};

const CARDIO_EXERCISE_PATTERN =
  /\b(run|running|jog|walk|walking|cycle|cycling|bike|biking|treadmill|elliptical|rower|cardio|sprint|jump rope|stair|ski|spin|air bike|assault bike|cross trainer)\b/i;

const CARDIO_PRIMARY_SLUGS: BodyMuscleSlug[] = ["quadriceps", "calves"];

const CATEGORY_PRIMARY_SLUGS: Partial<Record<string, BodyMuscleSlug[]>> = {
  push: ["chest", "deltoids", "triceps"],
  pull: ["upper-back", "biceps"],
  legs: ["quadriceps", "hamstring", "gluteal"],
  core: ["abs", "obliques"],
  upper: ["chest", "deltoids", "upper-back"],
  cardio: CARDIO_PRIMARY_SLUGS,
  full: ["chest", "quadriceps", "upper-back", "abs"],
};

function normalizeText(parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ");
}

function catalogMusclesToSlugs(muscles: string[]): BodyMuscleSlug[] {
  const slugs = new Set<BodyMuscleSlug>();
  for (const muscle of muscles) {
    const key = muscle.toLowerCase();
    if (key.includes("cardiovascular")) continue;

    const slug =
      CATALOG_MUSCLE_TO_SLUG[key] ??
      Object.entries(CATALOG_MUSCLE_TO_SLUG).find(([label]) => key.includes(label))?.[1];
    if (slug) slugs.add(slug);
  }
  return [...slugs];
}

function isCardioCatalogExercise(entry: CatalogExercise): boolean {
  if (CARDIO_EXERCISE_PATTERN.test(entry.name)) return true;

  const muscleText = [...entry.primary_muscles, ...entry.secondary_muscles]
    .join(" ")
    .toLowerCase();
  return muscleText.includes("cardiovascular");
}

function isSignificantSecondary(
  primarySlugs: BodyMuscleSlug[],
  secondarySlug: BodyMuscleSlug
): boolean {
  for (const primary of primarySlugs) {
    if (SIGNIFICANT_SYNERGISTS[primary]?.has(secondarySlug)) return true;
  }
  return false;
}

function slugsForCardioExercise(entry: CatalogExercise): BodyMuscleSlug[] {
  const all = catalogMusclesToSlugs([
    ...entry.primary_muscles,
    ...entry.secondary_muscles,
  ]);
  const matched = CARDIO_PRIMARY_SLUGS.filter((slug) => all.includes(slug));
  return matched.length > 0 ? matched : CARDIO_PRIMARY_SLUGS;
}

function applyIntensity(
  map: Map<BodyMuscleSlug, MuscleIntensity>,
  slug: BodyMuscleSlug,
  intensity: MuscleIntensity
) {
  const existing = map.get(slug);
  if (!existing || INTENSITY_PRIORITY[intensity] > INTENSITY_PRIORITY[existing]) {
    map.set(slug, intensity);
  }
}

function mapToHighlights(map: Map<BodyMuscleSlug, MuscleIntensity>): WorkoutMuscleHighlight[] {
  return [...map.entries()].map(([slug, intensity]) => ({ slug, intensity }));
}

function highlightsFromCatalogExercises(
  exercises: { name: string }[]
): WorkoutMuscleHighlight[] {
  const intensities = new Map<BodyMuscleSlug, MuscleIntensity>();

  for (const exercise of exercises) {
    const catalogEntry = findCatalogExercise(exercise.name);
    if (!catalogEntry) continue;

    if (isCardioCatalogExercise(catalogEntry)) {
      for (const slug of slugsForCardioExercise(catalogEntry)) {
        applyIntensity(intensities, slug, INTENSITY_PRIMARY_FOCUS);
      }
      continue;
    }

    const exercisePrimary = catalogMusclesToSlugs(catalogEntry.primary_muscles);
    const exerciseSecondary = catalogMusclesToSlugs(catalogEntry.secondary_muscles);

    for (const slug of exercisePrimary) {
      applyIntensity(intensities, slug, INTENSITY_PRIMARY_FOCUS);
    }

    for (const slug of exerciseSecondary) {
      if (exercisePrimary.includes(slug)) continue;
      applyIntensity(intensities, slug, INTENSITY_MODERATE_LOAD);
    }
  }

  return mapToHighlights(intensities);
}

function inferCategoriesFromText(...parts: (string | null | undefined)[]): string[] {
  const text = normalizeText(parts);
  const categories: string[] = [];

  if (/\b(core|abs|oblique|plank|crunch)\b/.test(text)) categories.push("core");
  if (/\b(cardio|hiit|run|bike|rower|conditioning|sprint|jump rope)\b/.test(text)) {
    categories.push("cardio");
  }
  if (/\b(push|press|chest|shoulder|tricep)\b/.test(text)) categories.push("push");
  if (/\b(pull|row|lat|chin|bicep)\b/.test(text)) categories.push("pull");
  if (/\b(leg|squat|lunge|glute|hamstring|calf|deadlift)\b/.test(text)) {
    categories.push("legs");
  }
  if (/\b(upper body|upper)\b/.test(text)) categories.push("upper");
  if (/\b(full body|full-body|total body)\b/.test(text)) categories.push("full");

  if (categories.length === 0) {
    const inferred = inferWorkoutCategoryFromText(...parts);
    if (inferred !== "general" && inferred !== "rest") {
      categories.push(inferred);
    }
  }

  return categories;
}

function highlightsFromCategoryFallback(
  categories: string[]
): WorkoutMuscleHighlight[] {
  const intensities = new Map<BodyMuscleSlug, MuscleIntensity>();
  const hasCardio = categories.includes("cardio");

  if (hasCardio) {
    for (const slug of CARDIO_PRIMARY_SLUGS) {
      applyIntensity(intensities, slug, INTENSITY_PRIMARY_FOCUS);
    }
  }

  for (const category of categories) {
    if (category === "cardio") continue;
    for (const slug of CATEGORY_PRIMARY_SLUGS[category] ?? []) {
      applyIntensity(intensities, slug, INTENSITY_PRIMARY_FOCUS);
    }
  }

  for (const [slug, intensity] of intensities) {
    if (intensity !== INTENSITY_PRIMARY_FOCUS) continue;
    for (const candidate of SIGNIFICANT_SYNERGISTS[slug] ?? []) {
      if (!intensities.has(candidate)) {
        applyIntensity(intensities, candidate, INTENSITY_MODERATE_LOAD);
      }
    }
  }

  return mapToHighlights(intensities);
}

export function resolveWorkoutMuscleHighlights(
  exercises: { name: string }[],
  dayTitle?: string
): WorkoutMuscleHighlight[] {
  const fromCatalog = highlightsFromCatalogExercises(exercises);
  if (fromCatalog.length > 0) return fromCatalog;

  const exerciseNames = exercises.map((exercise) => exercise.name);
  const categories = inferCategoriesFromText(dayTitle, ...exerciseNames);
  if (categories.length > 0) {
    return highlightsFromCategoryFallback(categories);
  }

  return [];
}

/** @deprecated Use resolveWorkoutMuscleHighlights */
export function resolveWorkoutMuscleSlugs(
  exercises: { name: string }[],
  dayTitle?: string
): BodyMuscleSlug[] {
  return resolveWorkoutMuscleHighlights(exercises, dayTitle).map((item) => item.slug);
}

export function toBodyHighlighterData(
  highlights: WorkoutMuscleHighlight[]
): { slug: BodyMuscleSlug; intensity: number }[] {
  const bySlug = new Map<BodyMuscleSlug, MuscleIntensity>();

  for (const item of highlights) {
    const existing = bySlug.get(item.slug);
    if (
      !existing ||
      INTENSITY_PRIORITY[item.intensity] > INTENSITY_PRIORITY[existing]
    ) {
      bySlug.set(item.slug, item.intensity);
    }
  }

  return [...bySlug.entries()].map(([slug, intensity]) => ({ slug, intensity }));
}

export function resolveBodyMapGender(
  gender: string | null | undefined
): "male" | "female" {
  return gender === "female" ? "female" : "male";
}

export { findCatalogExercise, getCatalogExercises };
export type { CatalogExercise };
