/**
 * Hard equipment validation + automatic repair for AI-generated workouts.
 * Catalog metadata is the source of truth — never trust the LLM alone.
 */

import {
  exerciseAllowedByConstraint,
  filterCatalogByEquipment,
  isUnrestricted,
  type EquipmentConstraint,
} from "@/lib/ai/equipment-taxonomy";
import type {
  AiGeneratedHiitPlan,
  AiGeneratedWorkoutDay,
  AiGeneratedWorkoutPlan,
  AiWorkoutExercise,
  AiWorkoutPlanResult,
} from "@/lib/ai/plan-builder-types";
import { isAiHiitPlan } from "@/lib/ai/plan-builder-types";
import {
  canonicalizeAiExerciseName,
  findCatalogExercise,
  getCatalogExercises,
  type CatalogExercise,
} from "@/lib/exercise-catalog";
import type { HiitConfig } from "@/lib/hiit";

export type EquipmentViolation = {
  name: string;
  reason: string;
  catalogEquipment: string[];
};

export type EquipmentRepair = {
  from: string;
  to: string;
  reason: string;
};

export type EquipmentEnforceResult<T> = {
  value: T;
  violations: EquipmentViolation[];
  repairs: EquipmentRepair[];
};

function muscleKey(ex: CatalogExercise): string {
  return (ex.primary_muscles[0] ?? ex.body_parts[0] ?? "full").toLowerCase();
}

function findReplacement(
  originalName: string,
  constraint: EquipmentConstraint,
  usedNames: Set<string>
): CatalogExercise | null {
  const allowed = filterCatalogByEquipment(getCatalogExercises(), constraint);
  if (allowed.length === 0) return null;

  const original =
    findCatalogExercise(originalName) ??
    findCatalogExercise(originalName, { equipment: constraint });

  const targetMuscle = original ? muscleKey(original) : null;

  // Prefer same primary muscle, unused, then any allowed.
  const sameMuscle = targetMuscle
    ? allowed.filter((ex) => muscleKey(ex) === targetMuscle)
    : [];

  const pools = [sameMuscle, allowed];
  for (const pool of pools) {
    const unused = pool.filter(
      (ex) => !usedNames.has(ex.name.toLowerCase())
    );
    const candidates = unused.length > 0 ? unused : pool;
    if (candidates.length === 0) continue;

    // Prefer canonicalized match within allowlist when possible.
    const canon = canonicalizeAiExerciseName(originalName, {
      equipment: constraint,
    });
    const canonHit = candidates.find(
      (ex) => ex.name.toLowerCase() === canon.toLowerCase()
    );
    if (canonHit) return canonHit;

    // Deterministic pick: first by name for stability in tests.
    return [...candidates].sort((a, b) => a.name.localeCompare(b.name))[0]!;
  }

  return null;
}

function enforceNamedExercises<T extends { name: string }>(
  exercises: T[],
  constraint: EquipmentConstraint
): EquipmentEnforceResult<T[]> {
  if (isUnrestricted(constraint)) {
    const renamed = exercises.map((ex) => {
      const name = canonicalizeAiExerciseName(ex.name);
      return name === ex.name ? ex : { ...ex, name };
    });
    return { value: renamed, violations: [], repairs: [] };
  }

  const violations: EquipmentViolation[] = [];
  const repairs: EquipmentRepair[] = [];
  const usedNames = new Set<string>();
  const result: T[] = [];

  for (const exercise of exercises) {
    const canonName = canonicalizeAiExerciseName(exercise.name, {
      equipment: constraint,
    });
    let catalog = findCatalogExercise(canonName, { equipment: constraint });

    // If canonicalize stayed on a free-form / gym name, try unrestricted lookup
    // to detect the violation, then repair.
    if (!catalog) {
      const unrestricted = findCatalogExercise(exercise.name);
      if (
        unrestricted &&
        !exerciseAllowedByConstraint(unrestricted, constraint)
      ) {
        violations.push({
          name: exercise.name,
          reason: `Requires ${unrestricted.equipment.join(", ") || "unknown"} which is not allowed (${constraint.label})`,
          catalogEquipment: unrestricted.equipment,
        });
        const replacement = findReplacement(
          exercise.name,
          constraint,
          usedNames
        );
        if (replacement) {
          repairs.push({
            from: exercise.name,
            to: replacement.name,
            reason: "equipment_violation",
          });
          usedNames.add(replacement.name.toLowerCase());
          result.push({ ...exercise, name: replacement.name });
          continue;
        }
        // Drop if we cannot repair.
        continue;
      }

      // Unknown name under constraint — try replacement from tokens / drop.
      violations.push({
        name: exercise.name,
        reason: `Could not map to an allowed catalog exercise (${constraint.label})`,
        catalogEquipment: [],
      });
      const replacement = findReplacement(exercise.name, constraint, usedNames);
      if (replacement) {
        repairs.push({
          from: exercise.name,
          to: replacement.name,
          reason: "unmapped_under_constraint",
        });
        usedNames.add(replacement.name.toLowerCase());
        result.push({ ...exercise, name: replacement.name });
      }
      continue;
    }

    if (!exerciseAllowedByConstraint(catalog, constraint)) {
      violations.push({
        name: exercise.name,
        reason: `Requires ${catalog.equipment.join(", ")} which is not allowed (${constraint.label})`,
        catalogEquipment: catalog.equipment,
      });
      const replacement = findReplacement(exercise.name, constraint, usedNames);
      if (replacement) {
        repairs.push({
          from: exercise.name,
          to: replacement.name,
          reason: "equipment_violation",
        });
        usedNames.add(replacement.name.toLowerCase());
        result.push({ ...exercise, name: replacement.name });
      }
      continue;
    }

    usedNames.add(catalog.name.toLowerCase());
    result.push(
      canonName === exercise.name ? exercise : { ...exercise, name: canonName }
    );
  }

  return { value: result, violations, repairs };
}

export function enforceEquipmentOnExercises(
  exercises: AiWorkoutExercise[],
  constraint: EquipmentConstraint
): EquipmentEnforceResult<AiWorkoutExercise[]> {
  return enforceNamedExercises(exercises, constraint);
}

export function enforceEquipmentOnHiitConfig(
  config: HiitConfig,
  constraint: EquipmentConstraint
): EquipmentEnforceResult<HiitConfig> {
  const enforced = enforceNamedExercises(config.exercises, constraint);
  return {
    value: { ...config, exercises: enforced.value },
    violations: enforced.violations,
    repairs: enforced.repairs,
  };
}

export function enforceEquipmentOnWorkoutPlan(
  plan: AiGeneratedWorkoutPlan,
  constraint: EquipmentConstraint
): EquipmentEnforceResult<AiGeneratedWorkoutPlan> {
  const violations: EquipmentViolation[] = [];
  const repairs: EquipmentRepair[] = [];
  const days = plan.days.map((day) => {
    const enforced = enforceNamedExercises(day.exercises, constraint);
    violations.push(...enforced.violations);
    repairs.push(...enforced.repairs);
    return { ...day, exercises: enforced.value };
  }).filter((day) => day.exercises.length > 0);

  return {
    value: {
      ...plan,
      days,
      days_per_week: Math.min(plan.days_per_week, Math.max(1, days.length)),
    },
    violations,
    repairs,
  };
}

export function enforceEquipmentOnWorkoutDay(
  day: AiGeneratedWorkoutDay,
  constraint: EquipmentConstraint
): EquipmentEnforceResult<AiGeneratedWorkoutDay> {
  const enforced = enforceNamedExercises(day.exercises, constraint);
  return {
    value: { ...day, exercises: enforced.value },
    violations: enforced.violations,
    repairs: enforced.repairs,
  };
}

export function enforceEquipmentOnHiitPlan(
  plan: AiGeneratedHiitPlan,
  constraint: EquipmentConstraint
): EquipmentEnforceResult<AiGeneratedHiitPlan> {
  const enforced = enforceEquipmentOnHiitConfig(plan.config, constraint);
  return {
    value: { ...plan, config: enforced.value },
    violations: enforced.violations,
    repairs: enforced.repairs,
  };
}

export function enforceEquipmentOnPlanResult(
  plan: AiWorkoutPlanResult,
  constraint: EquipmentConstraint
): EquipmentEnforceResult<AiWorkoutPlanResult> {
  if (isAiHiitPlan(plan)) {
    return enforceEquipmentOnHiitPlan(plan, constraint);
  }
  return enforceEquipmentOnWorkoutPlan(plan, constraint);
}

/** Log-friendly summary (no PII). */
export function summarizeEquipmentEnforcement(
  constraint: EquipmentConstraint,
  violations: EquipmentViolation[],
  repairs: EquipmentRepair[]
): void {
  if (violations.length === 0 && repairs.length === 0) return;
  console.info("[workout-equipment]", {
    constraint: constraint.label,
    violationCount: violations.length,
    repairCount: repairs.length,
    repairs: repairs.map((r) => `${r.from} → ${r.to}`),
  });
}
