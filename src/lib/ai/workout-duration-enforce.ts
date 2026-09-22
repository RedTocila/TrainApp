/**
 * Duration validation + automatic repair so generated sessions fit the target minutes.
 */

import { estimateWorkoutDurationSeconds } from "@/lib/workout-duration";
import type {
  AiGeneratedHiitPlan,
  AiGeneratedWorkoutDay,
  AiGeneratedWorkoutPlan,
  AiWorkoutDay,
  AiWorkoutExercise,
} from "@/lib/ai/plan-builder-types";
import type { WorkoutRequirements } from "@/lib/ai/workout-requirements";
import type { HiitConfig } from "@/lib/hiit";

export type DurationRepair = {
  type:
    | "reduce_rest"
    | "reduce_sets"
    | "remove_accessory"
    | "ok"
    | "under_target";
  detail: string;
  beforeMinutes: number;
  afterMinutes: number;
  targetMinutes: number;
};

export type DurationEnforceResult<T> = {
  value: T;
  repairs: DurationRepair[];
  estimatedMinutes: number;
};

/** Allow ± this many minutes around the target before repairing. */
export const DURATION_TOLERANCE_MINUTES = 5;

/** Never strip a session below this many exercises while repairing. */
const MIN_EXERCISES = 3;

export function estimateStrengthSessionMinutes(
  exercises: AiWorkoutExercise[]
): number {
  const seconds = estimateWorkoutDurationSeconds(
    exercises.map((ex) => ({
      target_sets: ex.sets,
      rest_seconds: ex.rest_seconds,
    }))
  );
  return Math.round(seconds / 60);
}

export function estimateHiitSessionMinutes(config: HiitConfig): number {
  const prepare = config.prepare_seconds ?? 10;
  const rounds = Math.max(1, config.rounds ?? 1);
  const cycles = Math.max(1, config.cycles ?? 1);
  const roundRest = config.round_rest_seconds ?? 60;
  const cycleRest = config.cycle_rest_seconds ?? 90;

  let perRound = 0;
  for (const ex of config.exercises) {
    perRound += (ex.work_seconds ?? 30) + (ex.rest_seconds ?? 15);
  }

  let total = prepare;
  for (let c = 0; c < cycles; c++) {
    for (let r = 0; r < rounds; r++) {
      total += perRound;
      if (r < rounds - 1) total += roundRest;
    }
    if (c < cycles - 1) total += cycleRest;
  }

  return Math.max(1, Math.round(total / 60));
}

function isRequiredName(
  name: string,
  requirements: WorkoutRequirements
): boolean {
  const lower = name.toLowerCase();
  return requirements.requiredExercises.some(
    (r) =>
      (r.catalogName && r.catalogName.toLowerCase() === lower) ||
      r.query.toLowerCase() === lower
  );
}

/**
 * Shrink a strength session toward targetMinutes.
 * Order: shorten rest → drop a set on trailing non-required → remove trailing accessories.
 */
export function repairStrengthSessionDuration(
  exercises: AiWorkoutExercise[],
  targetMinutes: number,
  requirements: WorkoutRequirements
): DurationEnforceResult<AiWorkoutExercise[]> {
  let current = exercises.map((ex) => ({ ...ex }));
  const repairs: DurationRepair[] = [];
  const before = estimateStrengthSessionMinutes(current);

  if (before <= targetMinutes + DURATION_TOLERANCE_MINUTES) {
    return {
      value: current,
      repairs:
        before < targetMinutes - DURATION_TOLERANCE_MINUTES * 2
          ? [
              {
                type: "under_target",
                detail: "Session shorter than target (left as-is)",
                beforeMinutes: before,
                afterMinutes: before,
                targetMinutes,
              },
            ]
          : [
              {
                type: "ok",
                detail: "Within tolerance",
                beforeMinutes: before,
                afterMinutes: before,
                targetMinutes,
              },
            ],
      estimatedMinutes: before,
    };
  }

  // 1) Cap rest
  let changed = false;
  for (const ex of current) {
    if (ex.rest_seconds > 60) {
      ex.rest_seconds = Math.max(45, Math.min(ex.rest_seconds, 60));
      changed = true;
    }
  }
  if (changed) {
    const after = estimateStrengthSessionMinutes(current);
    repairs.push({
      type: "reduce_rest",
      detail: "Capped rest to ≤60s to fit duration",
      beforeMinutes: before,
      afterMinutes: after,
      targetMinutes,
    });
    if (after <= targetMinutes + DURATION_TOLERANCE_MINUTES) {
      return { value: current, repairs, estimatedMinutes: after };
    }
  }

  // 2) Reduce sets on trailing non-required (keep ≥2 sets)
  for (let i = current.length - 1; i >= 0; i--) {
    if (estimateStrengthSessionMinutes(current) <= targetMinutes + DURATION_TOLERANCE_MINUTES) {
      break;
    }
    const ex = current[i]!;
    if (isRequiredName(ex.name, requirements)) continue;
    if (ex.sets <= 2) continue;
    const beforeSets = estimateStrengthSessionMinutes(current);
    ex.sets -= 1;
    repairs.push({
      type: "reduce_sets",
      detail: `Reduced sets on ${ex.name} to ${ex.sets}`,
      beforeMinutes: beforeSets,
      afterMinutes: estimateStrengthSessionMinutes(current),
      targetMinutes,
    });
  }

  // 3) Remove trailing non-required accessories
  while (
    current.length > MIN_EXERCISES &&
    estimateStrengthSessionMinutes(current) > targetMinutes + DURATION_TOLERANCE_MINUTES
  ) {
    let removeIdx = -1;
    for (let i = current.length - 1; i >= 0; i--) {
      if (!isRequiredName(current[i]!.name, requirements)) {
        removeIdx = i;
        break;
      }
    }
    if (removeIdx < 0) break;
    const removed = current[removeIdx]!;
    const beforeRemove = estimateStrengthSessionMinutes(current);
    current = current.filter((_, i) => i !== removeIdx);
    repairs.push({
      type: "remove_accessory",
      detail: `Removed ${removed.name} to fit duration`,
      beforeMinutes: beforeRemove,
      afterMinutes: estimateStrengthSessionMinutes(current),
      targetMinutes,
    });
  }

  return {
    value: current,
    repairs,
    estimatedMinutes: estimateStrengthSessionMinutes(current),
  };
}

export function enforceDurationOnWorkoutDay<
  T extends AiWorkoutDay | AiGeneratedWorkoutDay,
>(
  day: T,
  requirements: WorkoutRequirements
): DurationEnforceResult<T> {
  if (requirements.durationMinutes == null) {
    const minutes = estimateStrengthSessionMinutes(day.exercises);
    return { value: day, repairs: [], estimatedMinutes: minutes };
  }

  const repaired = repairStrengthSessionDuration(
    day.exercises,
    requirements.durationMinutes,
    requirements
  );
  return {
    value: { ...day, exercises: repaired.value },
    repairs: repaired.repairs.filter((r) => r.type !== "ok" && r.type !== "under_target"),
    estimatedMinutes: repaired.estimatedMinutes,
  };
}

export function enforceDurationOnWorkoutPlan(
  plan: AiGeneratedWorkoutPlan,
  requirements: WorkoutRequirements
): DurationEnforceResult<AiGeneratedWorkoutPlan> {
  if (requirements.durationMinutes == null) {
    const minutes = plan.days.reduce(
      (sum, d) => sum + estimateStrengthSessionMinutes(d.exercises),
      0
    );
    return { value: plan, repairs: [], estimatedMinutes: minutes };
  }

  const repairs: DurationRepair[] = [];
  const days = plan.days.map((day) => {
    const enforced = enforceDurationOnWorkoutDay(day, requirements);
    repairs.push(...enforced.repairs);
    return enforced.value;
  });

  const estimatedMinutes = days.reduce(
    (sum, d) => sum + estimateStrengthSessionMinutes(d.exercises),
    0
  );

  return {
    value: { ...plan, days },
    repairs,
    estimatedMinutes,
  };
}

export function enforceDurationOnHiitPlan(
  plan: AiGeneratedHiitPlan,
  requirements: WorkoutRequirements
): DurationEnforceResult<AiGeneratedHiitPlan> {
  const target = requirements.durationMinutes;
  let config: HiitConfig = {
    ...plan.config,
    exercises: plan.config.exercises.map((ex) => ({ ...ex })),
  };
  const repairs: DurationRepair[] = [];
  const before = estimateHiitSessionMinutes(config);

  if (target == null) {
    return { value: plan, repairs: [], estimatedMinutes: before };
  }

  if (before <= target + DURATION_TOLERANCE_MINUTES) {
    return {
      value: plan,
      repairs: [],
      estimatedMinutes: before,
    };
  }

  // Reduce rounds first, then work seconds, then drop trailing moves.
  while (
    estimateHiitSessionMinutes(config) > target + DURATION_TOLERANCE_MINUTES &&
    (config.rounds ?? 1) > 2
  ) {
    config = { ...config, rounds: (config.rounds ?? 1) - 1 };
    repairs.push({
      type: "reduce_sets",
      detail: `Reduced HIIT rounds to ${config.rounds}`,
      beforeMinutes: before,
      afterMinutes: estimateHiitSessionMinutes(config),
      targetMinutes: target,
    });
  }

  for (const ex of config.exercises) {
    if (estimateHiitSessionMinutes(config) <= target + DURATION_TOLERANCE_MINUTES) {
      break;
    }
    if ((ex.work_seconds ?? 30) > 25) {
      ex.work_seconds = Math.max(20, (ex.work_seconds ?? 30) - 5);
    }
    if ((ex.rest_seconds ?? 15) > 10) {
      ex.rest_seconds = Math.max(8, (ex.rest_seconds ?? 15) - 5);
    }
  }

  while (
    config.exercises.length > MIN_EXERCISES &&
    estimateHiitSessionMinutes(config) > target + DURATION_TOLERANCE_MINUTES
  ) {
    const removed = config.exercises.pop();
    if (!removed) break;
    repairs.push({
      type: "remove_accessory",
      detail: `Removed HIIT move ${removed.name}`,
      beforeMinutes: before,
      afterMinutes: estimateHiitSessionMinutes(config),
      targetMinutes: target,
    });
  }

  return {
    value: { ...plan, config },
    repairs,
    estimatedMinutes: estimateHiitSessionMinutes(config),
  };
}

export function summarizeDurationRepairs(repairs: DurationRepair[]): void {
  const meaningful = repairs.filter(
    (r) => r.type !== "ok" && r.type !== "under_target"
  );
  if (meaningful.length === 0) return;
  console.info("[workout-duration]", {
    repairs: meaningful.map(
      (r) =>
        `${r.type}: ${r.detail} (${r.beforeMinutes}→${r.afterMinutes} min, target ${r.targetMinutes})`
    ),
  });
}

/** Prompt line when a duration target is set. */
export function buildDurationPromptHint(
  durationMinutes: number | null
): string {
  if (durationMinutes == null) return "";
  return `- HARD duration: each session must fit ≈ ${durationMinutes} minutes (warm-up transitions included). Prefer ${Math.max(
    4,
    Math.min(8, Math.round(durationMinutes / 6))
  )}–${Math.max(5, Math.min(10, Math.round(durationMinutes / 4)))} exercises, shorter rests for shorter sessions.`;
}
