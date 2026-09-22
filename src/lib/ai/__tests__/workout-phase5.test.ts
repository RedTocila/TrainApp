/**
 * Phase 5: history-based variety + duration validate/repair.
 * Run: npx tsx --test src/lib/ai/__tests__/workout-phase5.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildVarietyPromptHint,
  varietyContextFromUsage,
  varietyScoreDelta,
} from "../workout-variety";
import {
  DURATION_TOLERANCE_MINUTES,
  enforceDurationOnHiitPlan,
  enforceDurationOnWorkoutDay,
  estimateHiitSessionMinutes,
  estimateStrengthSessionMinutes,
  repairStrengthSessionDuration,
} from "../workout-duration-enforce";
import { buildWorkoutCandidatePool } from "../workout-candidate-pool";
import { resolveWorkoutRequirements } from "../workout-requirements";
import type { AiGeneratedHiitPlan, AiWorkoutExercise } from "../plan-builder-types";
import type { Profile } from "../../types";

function fakeProfile(equipmentAccess?: string[]): Profile {
  return {
    id: "test",
    gender: "male",
    intake_responses: {
      equipment_access: equipmentAccess ?? ["bodyweight"],
      training_experience: "intermediate",
    },
  } as Profile;
}

describe("varietyScoreDelta", () => {
  it("boosts never-used exercises and penalizes recent heavy use", () => {
    const variety = varietyContextFromUsage([
      { name: "Push-up", count: 4, lastUsedDaysAgo: 1 },
    ]);

    assert.ok(varietyScoreDelta("Mountain Climber", variety, "normal") > 0);
    assert.ok(varietyScoreDelta("Push-up", variety, "normal") < 0);
    assert.ok(
      varietyScoreDelta("Push-up", variety, "high") <
        varietyScoreDelta("Push-up", variety, "normal")
    );
  });

  it("returns 0 with empty variety context", () => {
    assert.equal(varietyScoreDelta("Push-up", null), 0);
    assert.equal(
      varietyScoreDelta("Push-up", varietyContextFromUsage([])),
      0
    );
  });
});

describe("buildVarietyPromptHint", () => {
  it("lists recently used exercises when variety context has hot names", () => {
    const variety = varietyContextFromUsage([
      { name: "Push-up", count: 3, lastUsedDaysAgo: 0 },
      { name: "Pull-up", count: 2, lastUsedDaysAgo: 3 },
    ]);
    const hint = buildVarietyPromptHint(variety, "high");
    assert.match(hint, /variety/i);
    assert.match(hint, /push-up/i);
    assert.match(hint, /pull-up/i);
  });
});

describe("buildWorkoutCandidatePool + variety", () => {
  it("keeps recently used exercises in the pool but ranks unused peers higher", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["bodyweight"]),
      "No equipment. Full body workout."
    );
    const variety = varietyContextFromUsage([
      { name: "Push-up", count: 5, lastUsedDaysAgo: 0 },
    ]);

    const withVariety = buildWorkoutCandidatePool(req, { variety, cap: 80 });
    const without = buildWorkoutCandidatePool(req, { cap: 80 });

    assert.ok(
      withVariety.candidates.some((c) => c.name.toLowerCase() === "push-up"),
      "variety must not hard-remove push-up"
    );

    const idxWith = withVariety.candidates.findIndex(
      (c) => c.name.toLowerCase() === "push-up"
    );
    const idxWithout = without.candidates.findIndex(
      (c) => c.name.toLowerCase() === "push-up"
    );
    assert.ok(idxWith >= 0 && idxWithout >= 0);
    assert.ok(
      idxWith >= idxWithout,
      `expected push-up later with variety (with=${idxWith}, without=${idxWithout})`
    );

    const unusedPriority = withVariety.candidates.findIndex(
      (c) => c.name.toLowerCase() === "mountain climber"
    );
    if (unusedPriority >= 0 && idxWith >= 0) {
      assert.ok(
        unusedPriority < idxWith,
        `unused mountain climber (${unusedPriority}) should rank above recent push-up (${idxWith})`
      );
    }
  });
});

describe("duration estimate + repair", () => {
  function fatSession(count: number): AiWorkoutExercise[] {
    return Array.from({ length: count }, (_, i) => ({
      name: i === 0 ? "Push-up" : `Accessory Move ${i}`,
      sets: 5,
      reps: "10-12",
      rest_seconds: 120,
    }));
  }

  it("estimates strength session minutes from sets and rest", () => {
    const minutes = estimateStrengthSessionMinutes([
      { name: "Push-up", sets: 3, reps: "10", rest_seconds: 60 },
      { name: "Squat", sets: 3, reps: "10", rest_seconds: 60 },
    ]);
    assert.ok(minutes > 5 && minutes < 40, `unexpected minutes: ${minutes}`);
  });

  it("repairs an oversized session down toward the target", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["bodyweight"]),
      "No equipment. 20 minute workout. Include push-ups."
    );
    assert.equal(req.durationMinutes, 20);

    const before = fatSession(10);
    const beforeMin = estimateStrengthSessionMinutes(before);
    assert.ok(
      beforeMin > 20 + DURATION_TOLERANCE_MINUTES,
      `fixture not oversized: ${beforeMin}`
    );

    const repaired = repairStrengthSessionDuration(before, 20, req);
    assert.ok(
      repaired.estimatedMinutes <= 20 + DURATION_TOLERANCE_MINUTES,
      `still too long: ${repaired.estimatedMinutes}`
    );
    assert.ok(
      repaired.value.some((e) => /push-up/i.test(e.name)),
      "required push-up must survive repair"
    );
    assert.ok(
      repaired.repairs.some(
        (r) =>
          r.type === "reduce_rest" ||
          r.type === "reduce_sets" ||
          r.type === "remove_accessory"
      )
    );
  });

  it("enforceDurationOnWorkoutDay leaves in-tolerance sessions alone", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["bodyweight"]),
      "No equipment. 45 minute workout."
    );
    const day = {
      title: "Full Body",
      exercises: [
        { name: "Push-up", sets: 3, reps: "10", rest_seconds: 60 },
        { name: "Walking Lunge", sets: 3, reps: "10", rest_seconds: 60 },
        { name: "Front Plank with Twist", sets: 3, reps: "30s", rest_seconds: 45 },
        { name: "Mountain Climber", sets: 3, reps: "12", rest_seconds: 45 },
      ],
    };
    const enforced = enforceDurationOnWorkoutDay(day, req);
    assert.equal(enforced.repairs.length, 0);
    assert.equal(enforced.value.exercises.length, day.exercises.length);
  });

  it("repairs oversized HIIT toward duration target", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["bodyweight"]),
      "No equipment. 15 minute HIIT."
    );
    assert.equal(req.durationMinutes, 15);

    const plan: AiGeneratedHiitPlan = {
      kind: "hiit",
      title: "Long HIIT",
      description: "",
      coach_notes: [],
      config: {
        prepare_seconds: 10,
        rounds: 6,
        round_rest_seconds: 90,
        cycles: 2,
        cycle_rest_seconds: 120,
        exercises: [
          { name: "Burpee", work_seconds: 45, rest_seconds: 20 },
          { name: "Mountain Climber", work_seconds: 45, rest_seconds: 20 },
          { name: "Jumping Jack", work_seconds: 40, rest_seconds: 15 },
          { name: "High Knees", work_seconds: 40, rest_seconds: 15 },
          { name: "Push-up", work_seconds: 40, rest_seconds: 15 },
          { name: "Squat Jump", work_seconds: 40, rest_seconds: 15 },
        ],
      },
    };

    const before = estimateHiitSessionMinutes(plan.config);
    assert.ok(before > 15 + DURATION_TOLERANCE_MINUTES, `fixture not oversized: ${before}`);

    const enforced = enforceDurationOnHiitPlan(plan, req);
    assert.ok(
      enforced.estimatedMinutes <= 15 + DURATION_TOLERANCE_MINUTES,
      `HIIT still too long: ${enforced.estimatedMinutes}`
    );
    assert.ok(enforced.repairs.length > 0);
    assert.ok(enforced.value.config.exercises.length >= 3);
  });
});
