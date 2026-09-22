/**
 * Phase 3: candidate pool filter-then-generate tests.
 * Run: npx tsx --test src/lib/ai/__tests__/workout-candidate-pool.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWorkoutCandidatePool,
  candidatePoolHasName,
  pickReplacementFromPool,
} from "../workout-candidate-pool";
import { enforceCandidatePoolOnExercises } from "../workout-candidate-pool-enforce";
import { resolveWorkoutRequirements } from "../workout-requirements";
import { exerciseAllowedByConstraint } from "../equipment-taxonomy";
import { findCatalogExercise } from "../../exercise-catalog";
import type { Profile } from "../../types";

function fakeProfile(equipmentAccess?: string[]): Profile {
  return {
    id: "test",
    intake_responses: {
      equipment_access: equipmentAccess ?? ["full_gym"],
      training_experience: "intermediate",
    },
  } as Profile;
}

describe("buildWorkoutCandidatePool", () => {
  it("excludes equipment-incompatible exercises for no-equipment", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["full_gym"]),
      "Create a workout with no equipment."
    );
    const pool = buildWorkoutCandidatePool(req);
    assert.ok(pool.candidates.length > 20, `pool too small: ${pool.candidates.length}`);
    for (const c of pool.candidates) {
      const ex = findCatalogExercise(c.name);
      assert.ok(ex);
      assert.ok(
        exerciseAllowedByConstraint(ex!, req.equipment),
        `${c.name} equipment=${ex!.equipment.join(",")}`
      );
    }
  });

  it("excludes squat family when requested", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["bodyweight"]),
      "No equipment. Don't include squats."
    );
    const pool = buildWorkoutCandidatePool(req);
    assert.ok(!pool.candidates.some((c) => /squat/i.test(c.name)));
  });

  it("includes required push-up in pool", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["bodyweight"]),
      "No equipment. Include push-ups."
    );
    const pool = buildWorkoutCandidatePool(req);
    assert.ok(
      pool.candidates.some((c) => /push-up/i.test(c.name)),
      "push-up missing from pool"
    );
  });

  it("soft-filters chest focus toward chest/pectoral candidates", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["full_gym"]),
      "Give me a chest workout using only dumbbells."
    );
    const pool = buildWorkoutCandidatePool(req);
    assert.ok(pool.candidates.length > 5);
    const chestish = pool.candidates.filter(
      (c) =>
        c.primary_muscles.includes("pectorals") ||
        c.body_parts.includes("chest")
    );
    assert.ok(
      chestish.length / pool.candidates.length >= 0.25,
      `expected meaningful chest share, got ${chestish.length}/${pool.candidates.length}`
    );
    for (const c of pool.candidates) {
      const ex = findCatalogExercise(c.name);
      assert.ok(ex);
      assert.ok(exerciseAllowedByConstraint(ex!, req.equipment));
    }
  });

  it("home does not force empty gym pool", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["home_dumbbells"]),
      "Give me a 20 minute home workout."
    );
    const pool = buildWorkoutCandidatePool(req);
    assert.ok(pool.candidates.length > 30);
    assert.ok(
      pool.candidates.some((c) => c.equipment.includes("dumbbell")),
      "expected dumbbell options for home weights"
    );
  });

  it("caps pool size", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["full_gym"]),
      "Full body workout."
    );
    const pool = buildWorkoutCandidatePool(req, { cap: 40 });
    assert.ok(pool.candidates.length <= 40);
  });
});

describe("enforceCandidatePoolOnExercises", () => {
  it("replaces out-of-pool barbell with an allowed candidate", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["bodyweight"]),
      "No equipment."
    );
    const pool = buildWorkoutCandidatePool(req);
    const { value, repairs } = enforceCandidatePoolOnExercises(
      [
        {
          name: "Barbell Bench Press",
          sets: 3,
          reps: "8",
          rest_seconds: 90,
        },
        { name: "Push-up", sets: 3, reps: "12", rest_seconds: 45 },
      ],
      pool,
      req.equipment
    );

    assert.ok(value.every((e) => candidatePoolHasName(pool, e.name)));
    assert.ok(repairs.some((r) => r.reason === "out_of_pool"));
    assert.ok(value.some((e) => /push-up/i.test(e.name)));
  });

  it("pickReplacementFromPool returns unused candidate", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["bodyweight"]),
      "No equipment. Full body."
    );
    const pool = buildWorkoutCandidatePool(req);
    const used = new Set([pool.candidates[0]!.name.toLowerCase()]);
    const pick = pickReplacementFromPool(
      pool,
      pool.candidates[0]!.name,
      used
    );
    assert.ok(pick);
    assert.notEqual(pick!.name.toLowerCase(), pool.candidates[0]!.name.toLowerCase());
  });
});
