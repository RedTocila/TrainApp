import { getCatalogExercises } from "@/lib/exercise-catalog";

/** Popular library names the model should copy exactly (demos attach by name). */
const PRIORITY_CATALOG_NAMES = [
  "barbell bench press",
  "barbell incline bench press",
  "dumbbell bench press",
  "dumbbell incline bench press",
  "push-up",
  "pull-up",
  "chin-up",
  "barbell deadlift",
  "barbell romanian deadlift",
  "barbell full squat",
  "barbell front squat",
  "barbell bent over row",
  "dumbbell bent over row",
  "cable seated row",
  "cable pulldown",
  "barbell seated overhead press",
  "dumbbell seated shoulder press",
  "dumbbell lateral raise",
  "dumbbell front raise",
  "dumbbell rear delt raise",
  "barbell curl",
  "dumbbell hammer curl",
  "cable pushdown",
  "dumbbell standing triceps extension",
  "barbell lying triceps extension",
  "lever leg extension",
  "lever lying leg curl",
  "sled 45в° leg press",
  "barbell lunge",
  "dumbbell walking lunge",
  "barbell glute bridge",
  "barbell standing calf raise",
  "dumbbell fly",
  "front plank with twist",
  "burpee",
  "jump squat",
  "mountain climber",
  "bicycle crunch",
  "russian twist",
] as const;

let cachedCatalogNameSet: Set<string> | null = null;

function catalogNameSet(): Set<string> {
  if (!cachedCatalogNameSet) {
    cachedCatalogNameSet = new Set(
      getCatalogExercises().map((ex) => ex.name.toLowerCase())
    );
  }
  return cachedCatalogNameSet;
}

/**
 * Soft constraint for AI prompts: only use names from the in-app exercise list.
 * Hard guarantee still happens via canonicalizeAiExerciseName after generation.
 */
export function buildCatalogExerciseNameRule(): string {
  const known = catalogNameSet();
  const sample = PRIORITY_CATALOG_NAMES.filter((name) => known.has(name.toLowerCase()));
  const listed = (sample.length > 0 ? sample : PRIORITY_CATALOG_NAMES)
    .slice(0, 36)
    .map((name) => `"${name}"`)
    .join(", ");

  return `- CRITICAL: Every "name" MUST be copied EXACTLY from the app exercise library (same spelling as library entries). Do NOT invent creative, branded, or slightly reworded names — demos (GIF/video) only attach when the name matches the library.
- Prefer these verified library names when they fit: ${listed}.
- If unsure of the exact library spelling, pick the closest common library name above rather than inventing a new phrase.`;
}
