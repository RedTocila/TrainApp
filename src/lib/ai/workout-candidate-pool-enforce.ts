/**
 * Ensure AI-selected exercises are in the filtered candidate pool.
 * Runs after equipment enforce, before/alongside requirements enforce.
 */

import {
  candidatePoolHasName,
  pickReplacementFromPool,
  type WorkoutCandidatePool,
} from "@/lib/ai/workout-candidate-pool";
import type {
  AiGeneratedHiitPlan,
  AiGeneratedWorkoutDay,
  AiGeneratedWorkoutPlan,
  AiWorkoutExercise,
} from "@/lib/ai/plan-builder-types";
import { canonicalizeAiExerciseName } from "@/lib/exercise-catalog";
import type { EquipmentConstraint } from "@/lib/ai/equipment-taxonomy";
import type { HiitConfig } from "@/lib/hiit";

export type CandidatePoolRepair = {
  from: string;
  to: string;
  reason: "out_of_pool" | "canonicalized_in_pool";
};

export type CandidatePoolEnforceResult<T> = {
  value: T;
  repairs: CandidatePoolRepair[];
  dropped: string[];
};

function enforceNamedList<T extends { name: string }>(
  exercises: T[],
  pool: WorkoutCandidatePool,
  equipment?: EquipmentConstraint | null
): CandidatePoolEnforceResult<T[]> {
  const repairs: CandidatePoolRepair[] = [];
  const dropped: string[] = [];
  const used = new Set<string>();
  const result: T[] = [];

  for (const ex of exercises) {
    const canon = canonicalizeAiExerciseName(ex.name, {
      equipment: equipment ?? null,
    });

    if (candidatePoolHasName(pool, canon)) {
      used.add(canon.toLowerCase());
      if (canon !== ex.name) {
        repairs.push({
          from: ex.name,
          to: canon,
          reason: "canonicalized_in_pool",
        });
        result.push({ ...ex, name: canon });
      } else {
        result.push(ex);
      }
      continue;
    }

    if (candidatePoolHasName(pool, ex.name)) {
      used.add(ex.name.toLowerCase());
      result.push(ex);
      continue;
    }

    const replacement = pickReplacementFromPool(pool, canon || ex.name, used);
    if (replacement) {
      repairs.push({
        from: ex.name,
        to: replacement.name,
        reason: "out_of_pool",
      });
      used.add(replacement.name.toLowerCase());
      result.push({ ...ex, name: replacement.name });
    } else {
      dropped.push(ex.name);
    }
  }

  return { value: result, repairs, dropped };
}

export function enforceCandidatePoolOnExercises(
  exercises: AiWorkoutExercise[],
  pool: WorkoutCandidatePool,
  equipment?: EquipmentConstraint | null
): CandidatePoolEnforceResult<AiWorkoutExercise[]> {
  return enforceNamedList(exercises, pool, equipment);
}

export function enforceCandidatePoolOnHiitConfig(
  config: HiitConfig,
  pool: WorkoutCandidatePool,
  equipment?: EquipmentConstraint | null
): CandidatePoolEnforceResult<HiitConfig> {
  const enforced = enforceNamedList(config.exercises, pool, equipment);
  return {
    value: { ...config, exercises: enforced.value },
    repairs: enforced.repairs,
    dropped: enforced.dropped,
  };
}

export function enforceCandidatePoolOnWorkoutPlan(
  plan: AiGeneratedWorkoutPlan,
  pool: WorkoutCandidatePool,
  equipment?: EquipmentConstraint | null
): CandidatePoolEnforceResult<AiGeneratedWorkoutPlan> {
  const repairs: CandidatePoolRepair[] = [];
  const dropped: string[] = [];
  const days = plan.days
    .map((day) => {
      const enforced = enforceNamedList(day.exercises, pool, equipment);
      repairs.push(...enforced.repairs);
      dropped.push(...enforced.dropped);
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
    dropped,
  };
}

export function enforceCandidatePoolOnWorkoutDay(
  day: AiGeneratedWorkoutDay,
  pool: WorkoutCandidatePool,
  equipment?: EquipmentConstraint | null
): CandidatePoolEnforceResult<AiGeneratedWorkoutDay> {
  const enforced = enforceNamedList(day.exercises, pool, equipment);
  return {
    value: { ...day, exercises: enforced.value },
    repairs: enforced.repairs,
    dropped: enforced.dropped,
  };
}

export function enforceCandidatePoolOnHiitPlan(
  plan: AiGeneratedHiitPlan,
  pool: WorkoutCandidatePool,
  equipment?: EquipmentConstraint | null
): CandidatePoolEnforceResult<AiGeneratedHiitPlan> {
  const enforced = enforceCandidatePoolOnHiitConfig(
    plan.config,
    pool,
    equipment
  );
  return {
    value: { ...plan, config: enforced.value },
    repairs: enforced.repairs,
    dropped: enforced.dropped,
  };
}

export function summarizeCandidatePoolRepairs(
  repairs: CandidatePoolRepair[],
  dropped: string[]
): void {
  if (repairs.length === 0 && dropped.length === 0) return;
  console.info("[workout-candidates:enforce]", {
    repairCount: repairs.length,
    droppedCount: dropped.length,
    repairs: repairs.map((r) => `${r.from} → ${r.to} (${r.reason})`),
    dropped,
  });
}
