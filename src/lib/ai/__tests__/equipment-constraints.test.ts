/**
 * Phase 1 equipment constraint tests.
 * Run: npx tsx --test src/lib/ai/__tests__/equipment-constraints.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATALOG_EQUIPMENT,
  equipmentConstraintFromIntakeAccess,
  exerciseAllowedByConstraint,
  isBodyweightOnlyConstraint,
  parseEquipmentConstraintFromText,
  resolveEquipmentConstraint,
} from "../equipment-taxonomy";
import {
  enforceEquipmentOnExercises,
  enforceEquipmentOnWorkoutPlan,
} from "../workout-equipment-enforce";
import {
  canonicalizeAiExerciseName,
  findCatalogExercise,
  getCatalogExercises,
} from "../../exercise-catalog";
import type { Profile } from "../../types";

function fakeProfile(equipmentAccess?: string[]): Profile {
  return {
    id: "test",
    intake_responses: equipmentAccess
      ? { equipment_access: equipmentAccess }
      : { equipment_access: ["bodyweight"] },
  } as Profile;
}

describe("parseEquipmentConstraintFromText", () => {
  it("detects no equipment", () => {
    const c = parseEquipmentConstraintFromText(
      "Create me a workout with no equipment"
    );
    assert.ok(c);
    assert.equal(c!.label, "request_no_equipment");
    assert.ok(c!.allowedTags?.has(CATALOG_EQUIPMENT.BODY_WEIGHT));
    assert.equal(c!.allowedTags?.size, 1);
  });

  it("detects dumbbells only", () => {
    const c = parseEquipmentConstraintFromText(
      "Create a full body workout with dumbbells only"
    );
    assert.ok(c);
    assert.equal(c!.label, "request_dumbbells_only");
    assert.ok(c!.allowedTags?.has(CATALOG_EQUIPMENT.DUMBBELL));
    assert.ok(!c!.allowedTags?.has(CATALOG_EQUIPMENT.BARBELL));
  });

  it("detects bands only", () => {
    const c = parseEquipmentConstraintFromText("Only use resistance bands");
    assert.ok(c);
    assert.equal(c!.label, "request_bands_only");
  });

  it("returns null when no equipment intent", () => {
    assert.equal(parseEquipmentConstraintFromText("Make it harder"), null);
  });
});

describe("equipmentConstraintFromIntakeAccess", () => {
  it("maps bodyweight intake", () => {
    const c = equipmentConstraintFromIntakeAccess(["bodyweight"]);
    assert.equal(c.label, "bodyweight");
    assert.equal(c.allowedTags?.size, 1);
  });

  it("maps full_gym to unrestricted", () => {
    const c = equipmentConstraintFromIntakeAccess(["full_gym"]);
    assert.equal(c.allowedTags, null);
  });

  it("maps home_dumbbells without barbells/machines", () => {
    const c = equipmentConstraintFromIntakeAccess(["home_dumbbells"]);
    assert.ok(c.allowedTags?.has(CATALOG_EQUIPMENT.DUMBBELL));
    assert.ok(!c.allowedTags?.has(CATALOG_EQUIPMENT.BARBELL));
    assert.ok(!c.allowedTags?.has(CATALOG_EQUIPMENT.LEVERAGE_MACHINE));
  });

  it("maps granular dumbbells intake without machines", () => {
    const c = equipmentConstraintFromIntakeAccess(["dumbbells"]);
    assert.equal(c.label, "granular_intake");
    assert.ok(c.allowedTags?.has(CATALOG_EQUIPMENT.DUMBBELL));
    assert.ok(c.allowedTags?.has(CATALOG_EQUIPMENT.BODY_WEIGHT));
    assert.equal(c.allowedTags?.has(CATALOG_EQUIPMENT.BARBELL), false);
    assert.equal(c.allowedTags?.has(CATALOG_EQUIPMENT.CABLE), false);
  });

  it("maps no equipment / none to bodyweight", () => {
    const c = equipmentConstraintFromIntakeAccess(["none"]);
    assert.equal(c.label, "bodyweight");
    assert.ok(isBodyweightOnlyConstraint(c));
  });
});

describe("resolveEquipmentConstraint priority", () => {
  it("request overrides intake full gym", () => {
    const c = resolveEquipmentConstraint(
      fakeProfile(["full_gym"]),
      "I don't have any equipment"
    );
    assert.equal(c.label, "request_no_equipment");
  });

  it("falls back to intake when request has no equipment phrase", () => {
    const c = resolveEquipmentConstraint(
      fakeProfile(["home_dumbbells"]),
      "Focus on glutes"
    );
    assert.equal(c.label, "home_dumbbells");
  });
});

describe("allowlist-aware canonicalize", () => {
  const bodyweight = equipmentConstraintFromIntakeAccess(["bodyweight"]);

  it("does not remap squat to barbell under bodyweight constraint", () => {
    const name = canonicalizeAiExerciseName("squat", {
      equipment: bodyweight,
    });
    const ex = findCatalogExercise(name, { equipment: bodyweight });
    assert.ok(ex, `expected catalog hit for ${name}`);
    assert.ok(
      exerciseAllowedByConstraint(ex!, bodyweight),
      `${name} must be bodyweight`
    );
    assert.ok(!/barbell/i.test(name), `got barbell remap: ${name}`);
  });

  it("keeps gym default squat → barbell when unrestricted", () => {
    const name = canonicalizeAiExerciseName("squat");
    assert.match(name, /barbell/i);
  });

  it("maps bodyweight squat to a bodyweight catalog exercise", () => {
    const name = canonicalizeAiExerciseName("bodyweight squat", {
      equipment: bodyweight,
    });
    const ex = findCatalogExercise(name, { equipment: bodyweight });
    assert.ok(ex);
    assert.ok(exerciseAllowedByConstraint(ex!, bodyweight));
  });

  it("maps push ups correctly", () => {
    const name = canonicalizeAiExerciseName("push ups", {
      equipment: bodyweight,
    });
    assert.equal(name.toLowerCase(), "push-up");
  });
});

describe("enforceEquipmentOnExercises", () => {
  const bodyweight = equipmentConstraintFromIntakeAccess(["bodyweight"]);
  const dumbbells = parseEquipmentConstraintFromText("dumbbells only")!;

  it("repairs barbell exercises under no-equipment constraint", () => {
    const { value, violations, repairs } = enforceEquipmentOnExercises(
      [
        {
          name: "Barbell Bench Press",
          sets: 3,
          reps: "8-10",
          rest_seconds: 90,
        },
        { name: "Push-up", sets: 3, reps: "12", rest_seconds: 60 },
        {
          name: "Barbell Full Squat",
          sets: 3,
          reps: "8-10",
          rest_seconds: 90,
        },
      ],
      bodyweight
    );

    assert.ok(violations.length >= 2);
    assert.ok(repairs.length >= 2);
    for (const ex of value) {
      const catalog = findCatalogExercise(ex.name, { equipment: bodyweight });
      assert.ok(catalog, `missing catalog for ${ex.name}`);
      assert.ok(
        exerciseAllowedByConstraint(catalog!, bodyweight),
        `${ex.name} violates bodyweight`
      );
    }
    assert.ok(value.some((e) => /push-up/i.test(e.name)));
  });

  it("strips machines/barbells under dumbbells-only", () => {
    const { value } = enforceEquipmentOnExercises(
      [
        {
          name: "Dumbbell Bench Press",
          sets: 3,
          reps: "10",
          rest_seconds: 60,
        },
        {
          name: "Barbell Full Squat",
          sets: 3,
          reps: "8",
          rest_seconds: 90,
        },
        {
          name: "Cable Seated Row",
          sets: 3,
          reps: "12",
          rest_seconds: 60,
        },
        {
          name: "Lever Leg Extension",
          sets: 3,
          reps: "12",
          rest_seconds: 60,
        },
      ],
      dumbbells
    );

    for (const ex of value) {
      const catalog = findCatalogExercise(ex.name, { equipment: dumbbells });
      assert.ok(catalog, `missing catalog for ${ex.name}`);
      assert.ok(
        exerciseAllowedByConstraint(catalog!, dumbbells),
        `${ex.name} equipment=${catalog!.equipment.join(",")}`
      );
      for (const tag of catalog!.equipment) {
        assert.ok(
          tag === "dumbbell" || tag === "body weight",
          `unexpected tag ${tag} on ${ex.name}`
        );
      }
    }
  });

  it("enforces across a multi-day plan", () => {
    const { value } = enforceEquipmentOnWorkoutPlan(
      {
        title: "Test",
        description: "",
        days_per_week: 2,
        days: [
          {
            title: "A",
            exercises: [
              {
                name: "Barbell Deadlift",
                sets: 3,
                reps: "5",
                rest_seconds: 120,
              },
            ],
          },
          {
            title: "B",
            exercises: [
              {
                name: "Cable Pulldown",
                sets: 3,
                reps: "10",
                rest_seconds: 60,
              },
            ],
          },
        ],
        coach_notes: [],
      },
      bodyweight
    );

    assert.ok(value.days.length >= 1);
    for (const day of value.days) {
      for (const ex of day.exercises) {
        const catalog = findCatalogExercise(ex.name, {
          equipment: bodyweight,
        });
        assert.ok(catalog);
        assert.ok(exerciseAllowedByConstraint(catalog!, bodyweight));
      }
    }
  });
});

describe("catalog bodyweight pool", () => {
  it("has a usable bodyweight exercise pool", () => {
    const c = equipmentConstraintFromIntakeAccess(["bodyweight"]);
    const allowed = getCatalogExercises().filter((ex) =>
      exerciseAllowedByConstraint(ex, c)
    );
    assert.ok(allowed.length > 100, `expected many BW exercises, got ${allowed.length}`);
  });
});
