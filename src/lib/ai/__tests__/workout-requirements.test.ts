/**
 * Phase 2: structured requirements + conflict detection tests.
 * Run: npx tsx --test src/lib/ai/__tests__/workout-requirements.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectRequirementConflicts,
  resolveWorkoutRequirements,
  WorkoutRequirementConflictError,
  assertNoRequirementConflicts,
} from "../workout-requirements";
import {
  enforceRequirementsOnExercises,
} from "../workout-requirements-enforce";
import {
  parseExcludedFamiliesFromText,
  parseRequiredExercisePhrases,
  resolveExerciseRef,
} from "../exercise-semantic-match";
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

describe("parseRequiredExercisePhrases", () => {
  it("extracts include push-ups", () => {
    const phrases = parseRequiredExercisePhrases("Include push ups.");
    assert.ok(phrases.some((p) => /push/.test(p)));
  });

  it("extracts multiple exercises", () => {
    const phrases = parseRequiredExercisePhrases(
      "Use push-ups and mountain climbers."
    );
    assert.ok(phrases.length >= 2);
  });
});

describe("parseExcludedFamiliesFromText", () => {
  it("detects no squats", () => {
    const families = parseExcludedFamiliesFromText("Don't include squats.");
    assert.ok(families.includes("squat"));
  });

  it("detects no jumping", () => {
    const families = parseExcludedFamiliesFromText("No jumping.");
    assert.ok(families.includes("jump"));
    assert.ok(families.includes("burpee"));
  });

  it("detects no lunges including bulgarian", () => {
    const families = parseExcludedFamiliesFromText("No lunges please.");
    assert.ok(families.includes("lunge"));
  });
});

describe("resolveWorkoutRequirements", () => {
  it("parses full body 20 minute home no equipment", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["full_gym"]),
      "Give me a 20 minute home full body workout with no equipment."
    );
    assert.equal(req.equipment.label, "request_no_equipment");
    assert.equal(req.durationMinutes, 20);
    assert.ok(req.focus.includes("full_body"));
    assert.equal(req.location, "home");
  });

  it("parses include push-ups under no equipment", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["bodyweight"]),
      "Create a workout with no equipment. Include push-ups."
    );
    assert.ok(req.requiredExercises.length >= 1);
    const push = req.requiredExercises.find((r) =>
      /push/.test(r.query)
    );
    assert.ok(push);
    assert.ok(push!.catalogName);
    assert.match(push!.catalogName!.toLowerCase(), /push/);
  });

  it("parses don't include squats", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["full_gym"]),
      "Full body workout. Don't include squats."
    );
    assert.ok(req.excludedFamilies.includes("squat"));
  });

  it("home does not imply no equipment without saying so", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["home_dumbbells"]),
      "Give me a 20 minute home workout."
    );
    assert.equal(req.location, "home");
    // Request has no "no equipment" — intake home_dumbbells remains
    assert.equal(req.equipment.label, "home_dumbbells");
  });

  it("detects high variety intent", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["full_gym"]),
      "Give me something completely different."
    );
    assert.equal(req.varietyLevel, "high");
  });
});

describe("detectRequirementConflicts", () => {
  it("flags no equipment + barbell squat", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["full_gym"]),
      "Create a no-equipment workout and include barbell squats."
    );
    const conflicts = detectRequirementConflicts(req);
    assert.ok(
      conflicts.some((c) => c.code === "required_vs_equipment"),
      `expected equipment conflict, got ${JSON.stringify(conflicts)}`
    );
  });

  it("allows include squats with no equipment via bodyweight remap", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["bodyweight"]),
      "No equipment. Include squats."
    );
    const conflicts = detectRequirementConflicts(req);
    assert.equal(
      conflicts.filter((c) => c.code === "required_vs_equipment").length,
      0,
      JSON.stringify(conflicts)
    );
    assert.ok(req.requiredExercises[0]?.catalogName);
  });

  it("flags include + exclude same family", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["full_gym"]),
      "Include squats but don't include squats."
    );
    const conflicts = detectRequirementConflicts(req);
    assert.ok(
      conflicts.some(
        (c) =>
          c.code === "required_vs_family_exclude" ||
          c.code === "required_vs_excluded"
      ),
      JSON.stringify(conflicts)
    );
  });

  it("assertNoRequirementConflicts throws typed error", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["full_gym"]),
      "No equipment but include barbell bench press."
    );
    assert.throws(
      () => assertNoRequirementConflicts(req),
      (err: unknown) => err instanceof WorkoutRequirementConflictError
    );
  });
});

describe("enforceRequirementsOnExercises", () => {
  it("injects missing required push-up", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["bodyweight"]),
      "No equipment. Include push-ups."
    );
    const { value, repairs } = enforceRequirementsOnExercises(
      [
        {
          name: "Walking Lunge",
          sets: 3,
          reps: "10",
          rest_seconds: 60,
        },
      ],
      req
    );
    assert.ok(value.some((e) => /push-up/i.test(e.name)));
    assert.ok(repairs.some((r) => r.type === "injected_required"));
  });

  it("removes squat family when excluded", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["bodyweight"]),
      "No equipment. Don't include squats."
    );
    const { value, repairs } = enforceRequirementsOnExercises(
      [
        {
          name: "Jump Squat",
          sets: 3,
          reps: "10",
          rest_seconds: 60,
        },
        {
          name: "Push-up",
          sets: 3,
          reps: "12",
          rest_seconds: 45,
        },
      ],
      req
    );
    assert.ok(!value.some((e) => /squat/i.test(e.name)));
    assert.ok(value.some((e) => /push-up/i.test(e.name)));
    assert.ok(repairs.length >= 1);
  });

  it("removes jumping moves when no jumping", () => {
    const req = resolveWorkoutRequirements(
      fakeProfile(["bodyweight"]),
      "No equipment. No jumping."
    );
    const { value } = enforceRequirementsOnExercises(
      [
        { name: "Burpee", sets: 3, reps: "8", rest_seconds: 45 },
        { name: "Jump Squat", sets: 3, reps: "10", rest_seconds: 45 },
        { name: "Push-up", sets: 3, reps: "12", rest_seconds: 45 },
      ],
      req
    );
    assert.ok(!value.some((e) => /jump|burpee/i.test(e.name)));
    assert.ok(value.some((e) => /push-up/i.test(e.name)));
  });
});

describe("resolveExerciseRef", () => {
  it("resolves pushups alias", () => {
    const ref = resolveExerciseRef("pushups");
    assert.ok(ref.catalogName);
    assert.match(ref.catalogName!.toLowerCase(), /push/);
  });
});
