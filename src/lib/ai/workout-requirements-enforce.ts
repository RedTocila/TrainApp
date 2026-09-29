/**
 * Post-generation enforcement for required / excluded exercises & families.
 * Runs after equipment enforcement.
 */

import type { EquipmentConstraint } from "@/lib/ai/equipment-taxonomy";
import {
  exerciseMatchesAnyFamily,
  type ExerciseFamilyId,
} from "@/lib/ai/exercise-semantic-match";
import type {
  AiGeneratedHiitPlan,
  AiGeneratedWorkoutDay,
  AiGeneratedWorkoutPlan,
  AiWorkoutExercise,
} from "@/lib/ai/plan-builder-types";
import {
  exerciseFilterFromRequirements,
  type WorkoutRequirements,
} from "@/lib/ai/workout-requirements";
import {
  canonicalizeAiExerciseName,
  findCatalogExercise,
} from "@/lib/exercise-catalog";
import { exerciseAllowedByConstraint } from "@/lib/ai/equipment-taxonomy";
import { exerciseRejection, pickAlternative } from "@/lib/ai/exercise-knowledge";
import { getExerciseProfile } from "@/lib/ai/exercise-profile";
import type { HiitConfig } from "@/lib/hiit";

export type RequirementRepair = {
  type:
    | "removed_excluded"
    | "injected_required"
    | "replaced_excluded"
    | "replaced_violation"
    | "removed_violation"
    | "removed_duplicate"
    | "clamped_volume";
  from?: string;
  to?: string;
  detail: string;
};

export type RequirementsEnforceResult<T> = {
  value: T;
  repairs: RequirementRepair[];
};

function isExcludedName(
  name: string,
  requirements: WorkoutRequirements
): boolean {
  if (exerciseMatchesAnyFamily(name, requirements.excludedFamilies)) {
    return true;
  }
  const lower = name.toLowerCase();
  for (const excl of requirements.excludedExercises) {
    if (excl.catalogName && excl.catalogName.toLowerCase() === lower) {
      return true;
    }
    if (excl.query && lower.includes(excl.query.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/** Pattern-aware replacement that satisfies every hard requirement. */
function findNonExcludedReplacement(
  originalName: string,
  requirements: WorkoutRequirements,
  used: Set<string>,
  options?: { avoidSameFamily?: boolean }
): string | null {
  const original =
    findCatalogExercise(originalName) ??
    findCatalogExercise(originalName, { equipment: requirements.equipment });
  const pick = pickAlternative(original ?? originalName, {
    filter: exerciseFilterFromRequirements(requirements),
    usedNames: used,
    avoidSameFamily: options?.avoidSameFamily ?? false,
    preferGroups: requirements.focusGroups,
  });
  if (!pick || isExcludedName(pick.name, requirements)) return null;
  return pick.name;
}

function requiredNameSet(requirements: WorkoutRequirements): Set<string> {
  return new Set(
    requirements.requiredExercises
      .map((r) => r.catalogName?.toLowerCase())
      .filter(Boolean) as string[]
  );
}

/** Stable reorder: compound lifts before accessories (skips mixed mobility lists). */
function orderCompoundsFirst<T extends { name: string }>(list: T[]): T[] {
  if (list.length < 3) return list;
  const profiles = list.map((ex) => {
    const cat = findCatalogExercise(ex.name);
    return cat ? getExerciseProfile(cat) : null;
  });
  if (profiles.some((p) => p?.isMobility || p?.pattern === "plyometric" || p?.pattern === "cardio")) {
    return list;
  }
  const compound = list.filter((_, i) => profiles[i]?.isCompound);
  const rest = list.filter((_, i) => !profiles[i]?.isCompound);
  return [...compound, ...rest];
}

function defaultSetsForDifficulty(
  difficulty: WorkoutRequirements["difficulty"]
): { sets: number; reps: string; rest_seconds: number } {
  switch (difficulty) {
    case "beginner":
      return { sets: 2, reps: "10-12", rest_seconds: 60 };
    case "advanced":
      return { sets: 4, reps: "6-8", rest_seconds: 90 };
    default:
      return { sets: 3, reps: "8-10", rest_seconds: 75 };
  }
}

function enforceOnNamedList<T extends { name: string }>(
  exercises: T[],
  requirements: WorkoutRequirements,
  makeRequired: (name: string, template: T | null) => T
): RequirementsEnforceResult<T[]> {
  const repairs: RequirementRepair[] = [];
  const used = new Set<string>();
  const result: T[] = [];
  const filter = exerciseFilterFromRequirements(requirements);
  const required = requiredNameSet(requirements);

  for (const ex of exercises) {
    const canon = canonicalizeAiExerciseName(ex.name, {
      equipment: requirements.equipment,
    });
    const lowerCanon = canon.toLowerCase();
    if (used.has(lowerCanon)) {
      repairs.push({ type: "removed_duplicate", from: ex.name, detail: "duplicate_in_session" });
      continue;
    }
    const catalog = findCatalogExercise(canon);
    const rejection =
      catalog && !required.has(lowerCanon) ? exerciseRejection(catalog, filter) : null;
    if (rejection && rejection.code !== "excluded_family" && rejection.code !== "excluded_name") {
      const replacement = findNonExcludedReplacement(canon, requirements, used);
      if (replacement) {
        repairs.push({
          type: "replaced_violation",
          from: ex.name,
          to: replacement,
          detail: `${rejection.code}:${rejection.detail}`,
        });
        used.add(replacement.toLowerCase());
        result.push({ ...ex, name: replacement });
      } else {
        repairs.push({
          type: "removed_violation",
          from: ex.name,
          detail: `${rejection.code}:${rejection.detail}`,
        });
      }
      continue;
    }
    if (isExcludedName(canon, requirements) || isExcludedName(ex.name, requirements)) {
      const replacement = findNonExcludedReplacement(
        canon,
        requirements,
        used,
        { avoidSameFamily: true }
      );
      if (replacement) {
        repairs.push({
          type: "replaced_excluded",
          from: ex.name,
          to: replacement,
          detail: "excluded_by_requirements",
        });
        used.add(replacement.toLowerCase());
        result.push({ ...ex, name: replacement });
      } else {
        repairs.push({
          type: "removed_excluded",
          from: ex.name,
          detail: "excluded_by_requirements",
        });
      }
      continue;
    }
    used.add(canon.toLowerCase());
    result.push(canon === ex.name ? ex : { ...ex, name: canon });
  }

  // Inject missing required exercises.
  for (const req of requirements.requiredExercises) {
    const target = req.catalogName;
    if (!target) continue;
    const catalog = findCatalogExercise(target, {
      equipment: requirements.equipment,
    });
    if (!catalog) continue;
    if (!exerciseAllowedByConstraint(catalog, requirements.equipment)) continue;
    if (isExcludedName(catalog.name, requirements)) continue;

    const already = result.some(
      (ex) => ex.name.toLowerCase() === catalog.name.toLowerCase()
    );
    if (already) continue;

    const template = result[0] ?? null;
    result.push(makeRequired(catalog.name, template));
    used.add(catalog.name.toLowerCase());
    repairs.push({
      type: "injected_required",
      to: catalog.name,
      detail: `required:${req.query}`,
    });
  }

  // Optional exact count trim/pad is soft — only trim excess when hard count set
  // and we have more than requested (keep required ones).
  if (
    requirements.exerciseCount != null &&
    result.length > requirements.exerciseCount
  ) {
    const requiredNames = new Set(
      requirements.requiredExercises
        .map((r) => r.catalogName?.toLowerCase())
        .filter(Boolean) as string[]
    );
    const kept: T[] = [];
    const rest: T[] = [];
    for (const ex of result) {
      if (requiredNames.has(ex.name.toLowerCase())) kept.push(ex);
      else rest.push(ex);
    }
    const need = Math.max(0, requirements.exerciseCount - kept.length);
    result.length = 0;
    result.push(...kept, ...rest.slice(0, need));
  }

  return { value: result, repairs };
}

const BEGINNER_MAX_SETS = 4;

export function enforceRequirementsOnExercises(
  exercises: AiWorkoutExercise[],
  requirements: WorkoutRequirements
): RequirementsEnforceResult<AiWorkoutExercise[]> {
  const defaults = defaultSetsForDifficulty(requirements.difficulty);
  const enforced = enforceOnNamedList(exercises, requirements, (name, template) => ({
    name,
    sets: template?.sets ?? defaults.sets,
    reps: template?.reps ?? defaults.reps,
    rest_seconds: template?.rest_seconds ?? defaults.rest_seconds,
    notes: template?.notes,
  }));
  let value = enforced.value;
  if (requirements.experience === "beginner" && requirements.difficultySource !== "request") {
    value = value.map((ex) => {
      if (ex.sets <= BEGINNER_MAX_SETS) return ex;
      enforced.repairs.push({
        type: "clamped_volume",
        from: ex.name,
        detail: `sets ${ex.sets}→${BEGINNER_MAX_SETS} (beginner)`,
      });
      return { ...ex, sets: BEGINNER_MAX_SETS };
    });
  }
  return { value: orderCompoundsFirst(value), repairs: enforced.repairs };
}

export function enforceRequirementsOnHiitConfig(
  config: HiitConfig,
  requirements: WorkoutRequirements
): RequirementsEnforceResult<HiitConfig> {
  const enforced = enforceOnNamedList(
    config.exercises,
    requirements,
    (name, template) => ({
      name,
      work_seconds: template?.work_seconds ?? 40,
      rest_seconds: template?.rest_seconds ?? 20,
      notes: template?.notes ?? null,
      image_url: null,
      video_url: null,
    })
  );
  return {
    value: { ...config, exercises: enforced.value },
    repairs: enforced.repairs,
  };
}

export function enforceRequirementsOnWorkoutPlan(
  plan: AiGeneratedWorkoutPlan,
  requirements: WorkoutRequirements
): RequirementsEnforceResult<AiGeneratedWorkoutPlan> {
  const repairs: RequirementRepair[] = [];
  const days = plan.days
    .map((day) => {
      const enforced = enforceRequirementsOnExercises(
        day.exercises,
        requirements
      );
      repairs.push(...enforced.repairs);
      return { ...day, exercises: enforced.value };
    })
    .filter((d) => d.exercises.length > 0);

  return {
    value: {
      ...plan,
      days,
      days_per_week: Math.min(plan.days_per_week, Math.max(1, days.length)),
    },
    repairs,
  };
}

export function enforceRequirementsOnWorkoutDay(
  day: AiGeneratedWorkoutDay,
  requirements: WorkoutRequirements
): RequirementsEnforceResult<AiGeneratedWorkoutDay> {
  const enforced = enforceRequirementsOnExercises(day.exercises, requirements);
  return {
    value: { ...day, exercises: enforced.value },
    repairs: enforced.repairs,
  };
}

export function enforceRequirementsOnHiitPlan(
  plan: AiGeneratedHiitPlan,
  requirements: WorkoutRequirements
): RequirementsEnforceResult<AiGeneratedHiitPlan> {
  const enforced = enforceRequirementsOnHiitConfig(plan.config, requirements);
  return {
    value: { ...plan, config: enforced.value },
    repairs: enforced.repairs,
  };
}

export function summarizeRequirementRepairs(repairs: RequirementRepair[]): void {
  if (repairs.length === 0) return;
  console.info("[workout-requirements]", {
    repairCount: repairs.length,
    repairs: repairs.map((r) =>
      r.from && r.to
        ? `${r.type}: ${r.from} → ${r.to}`
        : `${r.type}: ${r.to ?? r.from ?? r.detail}`
    ),
  });
}

/** Helper for equipment+requirements pipeline logging. */
export function equipmentFromRequirements(
  requirements: WorkoutRequirements
): EquipmentConstraint {
  return requirements.equipment;
}

export type { ExerciseFamilyId };
