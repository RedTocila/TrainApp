/**
 * Filter-then-generate: build a constrained catalog candidate pool from
 * WorkoutRequirements BEFORE the LLM runs. The model must pick from this pool;
 * post-generation validation repairs any out-of-pool selections.
 */

import {
  exerciseAllowedByConstraint,
  filterCatalogByEquipment,
} from "@/lib/ai/equipment-taxonomy";
import {
  exerciseMatchesAnyFamily,
  type ExerciseFamilyId,
} from "@/lib/ai/exercise-semantic-match";
import type {
  WorkoutFocus,
  WorkoutRequirements,
} from "@/lib/ai/workout-requirements";
import {
  varietyScoreDelta,
  type VarietyContext,
} from "@/lib/ai/workout-variety";
import {
  findCatalogExercise,
  getCatalogExercises,
  type CatalogExercise,
} from "@/lib/exercise-catalog";

export type CandidateExercise = {
  id: string;
  name: string;
  primary_muscles: string[];
  body_parts: string[];
  equipment: string[];
};

export type WorkoutCandidatePool = {
  /** Filtered catalog exercises the LLM may use. */
  candidates: CandidateExercise[];
  /** Fast lookup by lowercased name. */
  nameSet: Set<string>;
  /** Fast lookup by catalog id. */
  idSet: Set<string>;
  /** How many exercises matched before capping. */
  totalMatched: number;
  /** Focus muscles used for soft ranking (empty = no focus filter). */
  focusMuscles: string[];
  focusBodyParts: string[];
};

const DEFAULT_POOL_CAP = 100;
const HIGH_VARIETY_CAP = 140;

/** Focus → primary muscles (catalog tags). */
const FOCUS_MUSCLES: Partial<Record<WorkoutFocus, string[]>> = {
  full_body: [],
  upper_body: [
    "pectorals",
    "lats",
    "upper back",
    "delts",
    "biceps",
    "triceps",
    "traps",
  ],
  lower_body: ["quads", "hamstrings", "glutes", "calves", "abductors", "adductors"],
  push: ["pectorals", "triceps", "delts", "serratus anterior"],
  pull: ["lats", "upper back", "biceps", "traps"],
  legs: ["quads", "hamstrings", "glutes", "calves", "abductors", "adductors"],
  chest: ["pectorals", "serratus anterior"],
  back: ["lats", "upper back", "traps", "spine"],
  shoulders: ["delts", "traps"],
  arms: ["biceps", "triceps", "forearms"],
  glutes: ["glutes", "hamstrings", "abductors"],
  core: ["abs", "spine"],
  hiit: ["cardiovascular system", "quads", "glutes", "abs", "pectorals"],
  cardio: ["cardiovascular system"],
  mobility: ["spine", "hamstrings", "abs", "calves", "delts"],
};

/** Focus → body_parts (catalog tags). */
const FOCUS_BODY_PARTS: Partial<Record<WorkoutFocus, string[]>> = {
  full_body: [],
  upper_body: ["chest", "back", "shoulders", "upper arms"],
  lower_body: ["upper legs", "lower legs"],
  push: ["chest", "shoulders", "upper arms"],
  pull: ["back", "upper arms"],
  legs: ["upper legs", "lower legs"],
  chest: ["chest"],
  back: ["back"],
  shoulders: ["shoulders"],
  arms: ["upper arms", "lower arms"],
  glutes: ["upper legs"],
  core: ["waist"],
  hiit: ["cardio", "upper legs", "waist", "chest"],
  cardio: ["cardio"],
  mobility: ["waist", "back", "upper legs", "shoulders"],
};

const PRIORITY_NAMES = new Set(
  [
    "push-up",
    "pull-up",
    "chin-up",
    "squat to overhead reach",
    "walking lunge",
    "low glute bridge on floor",
    "bodyweight standing row",
    "front plank with twist",
    "mountain climber",
    "bicycle crunch",
    "dumbbell bench press",
    "dumbbell goblet squat",
    "dumbbell bent over row",
    "dumbbell seated shoulder press",
    "dumbbell lateral raise",
    "barbell bench press",
    "barbell full squat",
    "barbell bent over row",
    "barbell deadlift",
    "cable seated row",
    "burpee",
    "russian twist",
    "crunch floor",
  ].map((n) => n.toLowerCase())
);

function isExcluded(
  ex: CatalogExercise,
  requirements: WorkoutRequirements
): boolean {
  if (exerciseMatchesAnyFamily(ex.name, requirements.excludedFamilies)) {
    return true;
  }
  const lower = ex.name.toLowerCase();
  for (const excl of requirements.excludedExercises) {
    if (excl.catalogName && excl.catalogName.toLowerCase() === lower) {
      return true;
    }
    if (excl.catalogId && excl.catalogId === ex.id) return true;
  }
  return false;
}

function collectFocusTargets(focus: WorkoutFocus[]): {
  muscles: string[];
  bodyParts: string[];
} {
  if (focus.length === 0 || focus.includes("full_body")) {
    return { muscles: [], bodyParts: [] };
  }
  const muscles = new Set<string>();
  const bodyParts = new Set<string>();
  for (const f of focus) {
    for (const m of FOCUS_MUSCLES[f] ?? []) muscles.add(m);
    for (const b of FOCUS_BODY_PARTS[f] ?? []) bodyParts.add(b);
  }
  return { muscles: [...muscles], bodyParts: [...bodyParts] };
}

function matchesFocus(
  ex: CatalogExercise,
  muscles: string[],
  bodyParts: string[]
): boolean {
  if (muscles.length === 0 && bodyParts.length === 0) return true;
  const muscleHit = ex.primary_muscles.some((m) => muscles.includes(m));
  const bodyHit = ex.body_parts.some((b) => bodyParts.includes(b));
  const secondaryHit = ex.secondary_muscles.some((m) => muscles.includes(m));
  return muscleHit || bodyHit || secondaryHit;
}

function scoreCandidate(
  ex: CatalogExercise,
  requirements: WorkoutRequirements,
  muscles: string[],
  bodyParts: string[],
  variety?: VarietyContext | null
): number {
  let score = 0;

  if (PRIORITY_NAMES.has(ex.name.toLowerCase())) score += 50;

  // Required exercises always rank highest (added separately, but boost if present).
  for (const req of requirements.requiredExercises) {
    if (req.catalogId === ex.id || req.catalogName?.toLowerCase() === ex.name.toLowerCase()) {
      score += 1000;
    }
  }

  if (muscles.length > 0 || bodyParts.length > 0) {
    if (ex.primary_muscles.some((m) => muscles.includes(m))) score += 30;
    else if (ex.body_parts.some((b) => bodyParts.includes(b))) score += 20;
    else if (ex.secondary_muscles.some((m) => muscles.includes(m))) score += 10;
  }

  // Prefer shorter, clearer names for programming quality.
  if (ex.name.length < 40) score += 5;
  if (/\(male\)|\(female\)|v\.\s*2|elite|extreme|athletic variation/i.test(ex.name)) {
    score -= 15;
  }

  // High variety: slight boost to non-priority names so the sample diversifies.
  if (requirements.varietyLevel === "high" && !PRIORITY_NAMES.has(ex.name.toLowerCase())) {
    score += 8;
  }

  // History-based variety: deprioritize recently / frequently used names.
  score += varietyScoreDelta(ex.name, variety, requirements.varietyLevel);

  return score;
}

function toCandidate(ex: CatalogExercise): CandidateExercise {
  return {
    id: ex.id,
    name: ex.name,
    primary_muscles: ex.primary_muscles,
    body_parts: ex.body_parts,
    equipment: ex.equipment,
  };
}

/**
 * Build the filtered candidate pool for a generation request.
 * Always includes resolved required exercises when they satisfy equipment.
 */
export function buildWorkoutCandidatePool(
  requirements: WorkoutRequirements,
  options?: { cap?: number; variety?: VarietyContext | null }
): WorkoutCandidatePool {
  const cap =
    options?.cap ??
    (requirements.varietyLevel === "high" ? HIGH_VARIETY_CAP : DEFAULT_POOL_CAP);
  const variety = options?.variety ?? null;

  const { muscles, bodyParts } = collectFocusTargets(requirements.focus);
  const equipmentFiltered = filterCatalogByEquipment(
    getCatalogExercises(),
    requirements.equipment
  ).filter((ex) => !isExcluded(ex, requirements));

  // Soft focus filter: if focus is set and enough matches, prefer focused set;
  // otherwise fall back to full equipment-allowed pool so generation never starves.
  let focused = equipmentFiltered.filter((ex) =>
    matchesFocus(ex, muscles, bodyParts)
  );
  if (focused.length < 12 && (muscles.length > 0 || bodyParts.length > 0)) {
    focused = equipmentFiltered;
  }

  const scored = focused
    .map((ex) => ({
      ex,
      // Select into the pool without variety so history never hard-removes options.
      score: scoreCandidate(ex, requirements, muscles, bodyParts, null),
    }))
    .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));

  const picked = new Map<string, CatalogExercise>();

  // 1) Required exercises first.
  for (const req of requirements.requiredExercises) {
    if (!req.catalogName) continue;
    const hit =
      findCatalogExercise(req.catalogName, {
        equipment: requirements.equipment,
      }) ?? findCatalogExercise(req.catalogName);
    if (!hit) continue;
    if (!exerciseAllowedByConstraint(hit, requirements.equipment)) continue;
    if (isExcluded(hit, requirements)) continue;
    picked.set(hit.id, hit);
  }

  // 2) Top scored candidates up to cap.
  for (const { ex } of scored) {
    if (picked.size >= cap) break;
    picked.set(ex.id, ex);
  }

  // 3) If still short (tiny allowlist), fill from equipment filter alphabetically.
  if (picked.size < Math.min(20, cap)) {
    const extras = [...equipmentFiltered].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const ex of extras) {
      if (picked.size >= Math.min(40, cap)) break;
      picked.set(ex.id, ex);
    }
  }

  // Re-order the final pool with variety weighting for prompt presentation.
  const candidates = [...picked.values()]
    .sort(
      (a, b) =>
        scoreCandidate(b, requirements, muscles, bodyParts, variety) -
          scoreCandidate(a, requirements, muscles, bodyParts, variety) ||
        a.name.localeCompare(b.name)
    )
    .map(toCandidate);
  const nameSet = new Set(candidates.map((c) => c.name.toLowerCase()));
  const idSet = new Set(candidates.map((c) => c.id));

  console.info("[workout-candidates]", {
    equipment: requirements.equipment.label,
    focus: requirements.focus,
    totalMatched: focused.length,
    poolSize: candidates.length,
    requiredInPool: requirements.requiredExercises.filter(
      (r) => r.catalogName && nameSet.has(r.catalogName.toLowerCase())
    ).length,
  });

  return {
    candidates,
    nameSet,
    idSet,
    totalMatched: focused.length,
    focusMuscles: muscles,
    focusBodyParts: bodyParts,
  };
}

/** Prompt block listing candidate library names the model MUST pick from. */
export function buildCandidatePoolPromptBlock(
  pool: WorkoutCandidatePool,
  options?: { maxListed?: number }
): string {
  const maxListed = options?.maxListed ?? 80;
  const listed = pool.candidates
    .slice(0, maxListed)
    .map((c) => `"${c.name}"`)
    .join(", ");

  return `- HARD: Every exercise "name" MUST be copied EXACTLY from this allowed candidate list (${pool.candidates.length} exercises filtered for equipment/focus/exclusions). Do NOT invent names or use exercises outside this list.
- Allowed candidates: ${listed}${
    pool.candidates.length > maxListed
      ? ` … (+${pool.candidates.length - maxListed} more in the filtered pool — still only use names from the full filtered set above/priority set).`
      : ""
  }
- If you need a movement not listed, pick the closest allowed candidate instead of inventing one.`;
}

export function candidatePoolHasName(
  pool: WorkoutCandidatePool,
  name: string
): boolean {
  return pool.nameSet.has(name.trim().toLowerCase());
}

/**
 * Find a replacement from the pool matching target muscle when possible.
 */
export function pickReplacementFromPool(
  pool: WorkoutCandidatePool,
  originalName: string,
  usedNames: Set<string>
): CandidateExercise | null {
  if (pool.candidates.length === 0) return null;

  const original = findCatalogExercise(originalName);
  const muscle =
    original?.primary_muscles[0] ?? original?.body_parts[0] ?? null;

  const sameMuscle = muscle
    ? pool.candidates.filter(
        (c) =>
          c.primary_muscles.includes(muscle) || c.body_parts.includes(muscle)
      )
    : [];

  const pools = [sameMuscle, pool.candidates];
  for (const group of pools) {
    const unused = group.filter(
      (c) => !usedNames.has(c.name.toLowerCase())
    );
    const pick = unused.length > 0 ? unused : group;
    if (pick.length === 0) continue;
    return [...pick].sort((a, b) => a.name.localeCompare(b.name))[0]!;
  }
  return null;
}

export type { ExerciseFamilyId };
