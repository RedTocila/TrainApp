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
import type { WorkoutRequirements } from "@/lib/ai/workout-requirements";
import {
  canonicalizeAiExerciseName,
  findCatalogExercise,
  getCatalogExercises,
} from "@/lib/exercise-catalog";
import {
  exerciseAllowedByConstraint,
  filterCatalogByEquipment,
} from "@/lib/ai/equipment-taxonomy";
import type { HiitConfig } from "@/lib/hiit";

export type RequirementRepair = {
  type: "removed_excluded" | "injected_required" | "replaced_excluded";
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

function findNonExcludedReplacement(
  originalName: string,
  requirements: WorkoutRequirements,
  used: Set<string>
): string | null {
  const equipment = requirements.equipment;
  const allowed = filterCatalogByEquipment(
    getCatalogExercises(),
    equipment
  ).filter((ex) => !isExcludedName(ex.name, requirements));

  const original = findCatalogExercise(originalName, { equipment });
  const muscle =
    original?.primary_muscles[0] ?? original?.body_parts[0] ?? null;

  const pool = muscle
    ? allowed.filter(
        (ex) =>
          ex.primary_muscles.includes(muscle) ||
          ex.body_parts.includes(muscle)
      )
    : allowed;

  const candidates = (pool.length > 0 ? pool : allowed).filter(
    (ex) => !used.has(ex.name.toLowerCase())
  );
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => a.name.localeCompare(b.name))[0]!.name;
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

  for (const ex of exercises) {
    const canon = canonicalizeAiExerciseName(ex.name, {
      equipment: requirements.equipment,
    });
    if (isExcludedName(canon, requirements) || isExcludedName(ex.name, requirements)) {
      const replacement = findNonExcludedReplacement(
        canon,
        requirements,
        used
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

export function enforceRequirementsOnExercises(
  exercises: AiWorkoutExercise[],
  requirements: WorkoutRequirements
): RequirementsEnforceResult<AiWorkoutExercise[]> {
  const defaults = defaultSetsForDifficulty(requirements.difficulty);
  return enforceOnNamedList(exercises, requirements, (name, template) => ({
    name,
    sets: template?.sets ?? defaults.sets,
    reps: template?.reps ?? defaults.reps,
    rest_seconds: template?.rest_seconds ?? defaults.rest_seconds,
    notes: template?.notes,
  }));
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
