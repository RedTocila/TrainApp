/**
 * Constraint-aware coach: the 20 required scenarios + pipeline pieces.
 * Pure modules only (no LLM / Supabase). LLM output is simulated with name lists.
 * Run: npx tsx --test src/lib/ai/__tests__/coach-constraints.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  exerciseFilterFromRequirements,
  resolveWorkoutRequirements,
  type WorkoutRequirements,
} from "../workout-requirements";
import { enforceRequirementsOnExercises } from "../workout-requirements-enforce";
import {
  generateWithValidation,
  stripHardViolations,
  validateExerciseNames,
  validateWorkoutDay,
  validateWorkoutPlan,
} from "../workout-constraint-validator";
import { buildWorkoutCandidatePool } from "../workout-candidate-pool";
import { exerciseRejection } from "../exercise-knowledge";
import { getExerciseProfile } from "../exercise-profile";
import { familiesForExerciseName } from "../exercise-semantic-match";
import { isStrictBodyweightConstraint } from "../equipment-taxonomy";
import { classifyCoachIntent } from "../coach-intent";
import { constraintsFromConversation, extractCoachConstraints } from "../coach-constraints";
import {
  adaptPlanToConstraints,
  removeExercisesMatching,
  removeWorkoutDay,
  replaceWorkoutExercise,
} from "../workout-surgical-edits";
import { guardToolForIntent } from "../coach-chat-tool-guard";
import { sanitizeDayFocuses } from "../weekly-focus-plan";
import { extractCoachChatContext } from "../coach-chat-context";
import {
  autoFixNutritionPlan,
  findFoodViolations,
  resolveNutritionConstraints,
} from "../nutrition-constraints";
import { findCatalogExercise } from "../../exercise-catalog";
import type {
  AiGeneratedNutritionPlan,
  AiGeneratedWorkoutPlan,
  AiWorkoutExercise,
} from "../plan-builder-types";
import type { Profile } from "../../types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function profile(responses: Record<string, unknown> = {}): Profile {
  return {
    id: "test",
    intake_responses: {
      equipment_access: ["full_gym"],
      training_experience: "intermediate",
      ...responses,
    },
  } as Profile;
}

const ex = (name: string, sets = 3, reps = "8-10"): AiWorkoutExercise => ({
  name,
  sets,
  reps,
  rest_seconds: 75,
});

function pplPlan(): AiGeneratedWorkoutPlan {
  return {
    kind: "strength",
    title: "PPL",
    description: "",
    days_per_week: 3,
    days: [
      { title: "Push Day", exercises: [ex("barbell bench press"), ex("dumbbell seated shoulder press"), ex("push-up", 4, "12-15")] },
      { title: "Pull Day", exercises: [ex("dumbbell bent over row"), ex("cable pulldown"), ex("dumbbell alternate biceps curl")] },
      { title: "Leg Day", exercises: [ex("dumbbell goblet squat"), ex("walking lunge"), ex("barbell deadlift")] },
    ],
    coach_notes: [],
  };
}

/** Simulated LLM output → deterministic enforcement → final guard (same order as the generators). */
function runPipeline(names: string[], req: WorkoutRequirements): string[] {
  const enforced = enforceRequirementsOnExercises(names.map((n) => ex(n)), req).value;
  return stripHardViolations(enforced, req).value.map((e) => e.name);
}

function assertAllPass(names: string[], req: WorkoutRequirements) {
  const filter = exerciseFilterFromRequirements(req);
  for (const name of names) {
    const cat = findCatalogExercise(name);
    assert.ok(cat, `unknown exercise ${name}`);
    const rejection = exerciseRejection(cat!, filter);
    assert.equal(rejection, null, `${name} should be allowed but got ${JSON.stringify(rejection)}`);
  }
}

function usesAnyEquipment(name: string): boolean {
  const cat = findCatalogExercise(name)!;
  const p = getExerciseProfile(cat);
  const tags = p.effectiveEquipmentTags.filter((t) => t !== "body weight");
  const props = p.propRequirements.flat().filter((prop) => prop !== "wall");
  return tags.length > 0 || props.length > 0;
}

const MESSY_LLM_OUTPUT = [
  "push-up",
  "dumbbell bench press",
  "resistance band seated straight back row",
  "pull-up",
  "incline push-up",
  "three bench dip",
  "mountain climber",
];

// ─── 1–3, 12–13: equipment ───────────────────────────────────────────────────

describe("1. no equipment", () => {
  const req = resolveWorkoutRequirements(profile(), "Make me a workout with no equipment");

  it("resolves to strict bodyweight (no props, no gear)", () => {
    assert.ok(isStrictBodyweightConstraint(req.equipment));
  });

  it("candidate pool contains only true bodyweight moves", () => {
    const pool = buildWorkoutCandidatePool(req, { cap: 120 });
    assert.ok(pool.candidates.length > 20);
    for (const c of pool.candidates) assert.equal(usesAnyEquipment(c.name), false, c.name);
  });

  it("strips bands, dumbbells, bars, benches and chairs from LLM output", () => {
    const out = runPipeline(MESSY_LLM_OUTPUT, req);
    assert.ok(out.length >= 4);
    for (const name of out) assert.equal(usesAnyEquipment(name), false, name);
    assert.ok(validateExerciseNames(out, req).every((v) => v.severity !== "hard"));
  });
});

describe("2. bodyweight only", () => {
  it("'bodyweight only' is literal — bench dips / incline push-ups are rejected", () => {
    const req = resolveWorkoutRequirements(profile(), "bodyweight only upper body please");
    assert.ok(isStrictBodyweightConstraint(req.equipment));
    const filter = exerciseFilterFromRequirements(req);
    for (const name of ["three bench dip", "incline push-up", "pull-up", "inverted row"]) {
      assert.equal(exerciseRejection(findCatalogExercise(name)!, filter)?.code, "equipment", name);
    }
    assert.equal(exerciseRejection(findCatalogExercise("push-up")!, filter), null);
  });
});

describe("3. no bands", () => {
  it("forbids band moves but keeps the rest of the gym", () => {
    const req = resolveWorkoutRequirements(profile(), "Chest and back workout, no bands");
    const out = runPipeline(["resistance band seated straight back row", "dumbbell bent over row", "barbell bench press"], req);
    assert.ok(!out.some((n) => /band/i.test(n)), out.join(", "));
    assert.ok(out.includes("dumbbell bent over row"));
    assert.ok(out.includes("barbell bench press"));
  });
});

describe("12. home with nothing", () => {
  it("'home workout, I have nothing' = strict bodyweight", () => {
    const req = resolveWorkoutRequirements(profile(), "home workout, I have nothing at home");
    assert.ok(isStrictBodyweightConstraint(req.equipment));
    const out = runPipeline(MESSY_LLM_OUTPUT, req);
    for (const name of out) assert.equal(usesAnyEquipment(name), false, name);
  });
});

describe("13. home with dumbbells", () => {
  const req = resolveWorkoutRequirements(profile(), "home workout with dumbbells");

  it("allows dumbbells + bodyweight only — no bands, machines or bench", () => {
    const filter = exerciseFilterFromRequirements(req);
    assert.equal(exerciseRejection(findCatalogExercise("dumbbell goblet squat")!, filter), null);
    assert.equal(exerciseRejection(findCatalogExercise("push-up")!, filter), null);
    for (const name of ["resistance band seated straight back row", "cable pulldown", "sled 45в° leg press", "dumbbell bench press"]) {
      assert.ok(exerciseRejection(findCatalogExercise(name)!, filter), `${name} should be rejected`);
    }
  });

  it("an explicitly mentioned bench is allowed", () => {
    const withBench = resolveWorkoutRequirements(profile(), "home workout, I have dumbbells and a bench");
    const filter = exerciseFilterFromRequirements(withBench);
    assert.equal(exerciseRejection(findCatalogExercise("dumbbell bench press")!, filter), null);
  });
});

// ─── 4–7: muscles, days, exercises ───────────────────────────────────────────

describe("4. don't train legs", () => {
  const req = resolveWorkoutRequirements(profile(), "full body workout but don't train legs");

  it("avoids all leg muscle groups", () => {
    for (const g of ["quads", "hamstrings", "glutes", "calves"] as const) assert.ok(req.avoidMuscles.includes(g), g);
  });

  it("removes squats, lunges, jumps and burpees", () => {
    const out = runPipeline(["push-up", "dumbbell goblet squat", "walking lunge", "jump squat", "burpee", "dumbbell bent over row"], req);
    const legGroups = new Set(["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"]);
    for (const name of out) {
      const p = getExerciseProfile(findCatalogExercise(name)!);
      assert.ok(!["squat", "lunge", "hinge"].includes(p.pattern), `${name} (${p.pattern})`);
      assert.ok(!p.primaryGroups.some((g) => legGroups.has(g)), `${name} (${p.primaryGroups.join(",")})`);
      assert.ok(!/squat|lunge|jump|burpee/i.test(name), name);
    }
    assert.ok(out.includes("push-up"));
  });
});

describe("5. remove leg day from an existing program", () => {
  it("classifies as remove_day (remove only)", () => {
    const intent = classifyCoachIntent("remove leg day", { hasExistingPlan: true });
    assert.equal(intent.primary, "remove_day");
    assert.equal(intent.removeOnly, true);
  });

  it("drops the day without adding a replacement", () => {
    const result = removeWorkoutDay(pplPlan(), { focus: ["legs"] });
    assert.equal(result.plan.days.length, 2);
    assert.equal(result.plan.days_per_week, 2);
    assert.deepEqual(result.plan.days.map((d) => d.title), ["Push Day", "Pull Day"]);
  });

  it("the tool guard blocks regenerating instead of removing", () => {
    const intent = classifyCoachIntent("remove leg day", { hasExistingPlan: true });
    assert.ok(guardToolForIntent("generate_workout_plan", intent, true));
    assert.ok(guardToolForIntent("edit_workout_plan", intent, true));
    assert.equal(guardToolForIntent("remove_workout_day", intent, true), null);
  });

  it("generation validation flags a regenerated plan that still has a leg day", () => {
    const req = resolveWorkoutRequirements(profile(), "remove leg day", { hasExistingPlan: true });
    assert.ok(req.excludedDayFocuses.includes("legs"));
    const report = validateWorkoutPlan(pplPlan(), req, { expectedDays: 3 });
    assert.ok(report.hard.some((v) => v.code === "excluded_day_focus"));
  });
});

describe("6. remove squats", () => {
  function plan(): AiGeneratedWorkoutPlan {
    const p = pplPlan();
    p.days[0]!.exercises.push(ex("jump squat"));
    return p;
  }

  it("classifies as remove-only", () => {
    const intent = classifyCoachIntent("remove squats", { hasExistingPlan: true });
    assert.equal(intent.primary, "remove_exercise");
    assert.equal(intent.removeOnly, true);
    assert.ok(guardToolForIntent("replace_workout_exercise", intent, true));
  });

  it("removes every squat variation across days, nothing else", () => {
    const result = removeExercisesMatching(plan(), { families: ["squat"] });
    const names = result.plan.days.flatMap((d) => d.exercises.map((e) => e.name));
    assert.ok(!names.some((n) => /squat/i.test(n)), names.join(", "));
    assert.ok(names.includes("walking lunge"));
    assert.ok(names.includes("push-up"));
    assert.equal(names.length, 9 + 1 - 2);
  });

  it("persists: 'no squats' earlier still applies to a later leg workout", () => {
    const req = resolveWorkoutRequirements(profile(), "make me a leg workout", {
      conversation: ["no squats please", "make me a leg workout"],
    });
    assert.ok(req.excludedFamilies.includes("squat"));
    const out = runPipeline(["dumbbell goblet squat", "walking lunge", "barbell deadlift"], req);
    assert.ok(!out.some((n) => /squat/i.test(n)), out.join(", "));
  });
});

describe("7. remove squats and replace them", () => {
  it("classifies as replace", () => {
    const intent = classifyCoachIntent("remove the squats and replace them with something else", { hasExistingPlan: true });
    assert.equal(intent.primary, "replace_exercise");
    assert.equal(intent.removeOnly, false);
  });

  it("auto-pick is a different movement family and keeps sets/reps", () => {
    const result = replaceWorkoutExercise(pplPlan(), profile(), {
      dayNumber: 3,
      exerciseName: "dumbbell goblet squat",
      conversation: ["replace the squats with something else"],
    });
    const replaced = result.plan.days[2]!.exercises[0]!;
    assert.notEqual(replaced.name, "dumbbell goblet squat");
    assert.ok(!familiesForExerciseName(replaced.name).includes("squat"), replaced.name);
    assert.equal(replaced.sets, 3);
    assert.equal(replaced.reps, "8-10");
    assert.equal(result.plan.days[2]!.exercises[1]!.name, "walking lunge");
  });
});

// ─── 8–11, 17: experience and focus ─────────────────────────────────────────

describe("8. beginner", () => {
  const req = resolveWorkoutRequirements(profile({ training_experience: "beginner" }), "upper body workout, bodyweight");

  it("caps difficulty at tier 1", () => {
    assert.equal(req.maxDifficulty, 1);
    assert.equal(req.experience, "beginner");
  });

  it("replaces elite moves with beginner-friendly ones", () => {
    const out = runPipeline(["archer push up", "muscle up", "handstand push-up", "push-up"], req);
    for (const name of out) {
      assert.ok(getExerciseProfile(findCatalogExercise(name)!).difficulty <= 1, name);
    }
    assert.ok(out.includes("push-up"));
  });
});

describe("9. advanced", () => {
  const req = resolveWorkoutRequirements(profile({ training_experience: "advanced" }), "upper body workout, bodyweight only");

  it("allows high-skill moves", () => {
    assert.equal(req.maxDifficulty, 4);
    const out = runPipeline(["archer push up", "handstand push-up", "diamond push-up"], req);
    assert.ok(out.includes("archer push up"));
    assert.ok(out.includes("handstand push-up"));
  });

  it("pool includes tier 3+ exercises", () => {
    const pool = buildWorkoutCandidatePool(req, { cap: 150 });
    assert.ok(pool.candidates.some((c) => getExerciseProfile(findCatalogExercise(c.name)!).difficulty >= 3));
  });
});

describe("10. chest focus", () => {
  const req = resolveWorkoutRequirements(profile(), "chest focused workout with dumbbells");

  it("biases the pool toward chest", () => {
    assert.ok(req.focusGroups.includes("chest"));
    const pool = buildWorkoutCandidatePool(req, { cap: 40 });
    const top = pool.candidates.slice(0, 10);
    const chest = top.filter((c) => getExerciseProfile(findCatalogExercise(c.name)!).primaryGroups.some((g) => g === "chest" || g === "upper_chest"));
    assert.ok(chest.length >= 6, `only ${chest.length}/10 chest in top candidates`);
  });

  it("validator flags a session that ignores the focus", () => {
    const off = validateExerciseNames(["dumbbell bent over row", "dumbbell alternate biceps curl", "dumbbell goblet squat", "dumbbell lateral raise"], req, { checkFocus: true });
    assert.ok(off.some((v) => v.code === "focus_bias"));
    const on = validateExerciseNames(["dumbbell fly", "push-up", "wide hand push up", "dumbbell bent over row"], req, { checkFocus: true, checkCount: false });
    assert.ok(!on.some((v) => v.code === "focus_bias"));
  });
});

describe("11. chest without shoulders", () => {
  const req = resolveWorkoutRequirements(profile(), "chest workout without shoulders");

  it("keeps chest focus and avoids delts", () => {
    assert.ok(req.focusGroups.includes("chest"));
    for (const g of ["front_delts", "side_delts", "rear_delts"] as const) assert.ok(req.avoidMuscles.includes(g), g);
  });

  it("removes overhead pressing / raises, keeps chest work", () => {
    const out = runPipeline(["barbell bench press", "barbell seated overhead press", "dumbbell lateral raise", "dumbbell fly"], req);
    for (const name of out) {
      const p = getExerciseProfile(findCatalogExercise(name)!);
      assert.notEqual(p.pattern, "vertical_push", name);
      assert.ok(!p.primaryGroups.some((g) => g.endsWith("delts")), name);
    }
    assert.ok(out.includes("barbell bench press"));
    assert.ok(out.includes("dumbbell fly"));
  });
});

describe("17. beginner asks for an advanced exercise", () => {
  const beginner = profile({ training_experience: "beginner", equipment_access: ["full_gym"] });

  it("regresses the move and explains why", () => {
    const req = resolveWorkoutRequirements(beginner, "back workout, include muscle ups");
    const muscleUp = req.requiredExercises.find((r) => /muscle/i.test(r.query));
    assert.ok(muscleUp, "muscle up request recognized");
    assert.notEqual(muscleUp!.catalogName, "muscle up");
    assert.ok(req.adjustments.some((a) => /muscle up/i.test(a)), req.adjustments.join(" | "));
  });

  it("keeps it when the client insists", () => {
    const req = resolveWorkoutRequirements(beginner, "back workout, include muscle ups — I can do them, trust me");
    assert.ok(req.requiredExercises.some((r) => r.catalogName === "muscle up"));
  });
});

// ─── 16, 18–20: modify, injury, combined, multi-turn ─────────────────────────

describe("16. modify an existing workout", () => {
  it("classifies 'make it bodyweight only' as an edit of the current plan", () => {
    const intent = classifyCoachIntent("make it bodyweight only", { hasExistingPlan: true });
    assert.equal(intent.primary, "change_equipment");
    assert.equal(intent.modifiesExisting, true);
  });

  it("adapts only the violating exercises and keeps the rest", () => {
    const req = resolveWorkoutRequirements(profile(), "make it bodyweight only", { hasExistingPlan: true });
    const before = pplPlan();
    const result = adaptPlanToConstraints(before, req);
    assert.equal(result.plan.days[0]!.exercises[2]!.name, "push-up");
    assert.equal(result.plan.days[0]!.exercises[2]!.sets, 4);
    assert.equal(result.plan.days[0]!.exercises[2]!.reps, "12-15");
    const names = result.plan.days.flatMap((d) => d.exercises.map((e) => e.name));
    for (const name of names) assert.equal(usesAnyEquipment(name), false, name);
    assert.ok(result.changes.length > 0);
  });
});

describe("18. injury respected", () => {
  it("profile knee injury rejects high knee-stress moves", () => {
    const req = resolveWorkoutRequirements(profile({ injury_areas: ["knees"] }), "leg workout");
    assert.ok(req.injuries.includes("knees"));
    const out = runPipeline(["jump squat", "walking lunge", "barbell glute bridge"], req);
    for (const name of out) {
      assert.ok(!getExerciseProfile(findCatalogExercise(name)!).highStressJoints.includes("knees"), name);
    }
  });

  it("pain mentioned in chat is picked up as a limitation", () => {
    const req = resolveWorkoutRequirements(profile(), "leg day but my knee hurts");
    assert.ok(req.injuries.includes("knees"));
  });
});

describe("19. beginner, bodyweight-only, 30-minute upper-body workout without shoulders", () => {
  const req = resolveWorkoutRequirements(
    profile({ training_experience: "intermediate" }),
    "beginner, bodyweight-only, 30-minute upper-body workout without shoulders"
  );

  it("extracts every constraint", () => {
    assert.ok(isStrictBodyweightConstraint(req.equipment));
    assert.equal(req.experience, "beginner");
    assert.equal(req.maxDifficulty, 1);
    assert.equal(req.durationMinutes, 30);
    assert.ok(req.avoidMuscles.includes("front_delts"));
    assert.ok(req.focus.includes("upper_body"));
  });

  it("final output satisfies all of them", () => {
    const out = runPipeline(
      ["push-up", "pike push-up", "archer push up", "dumbbell bench press", "diamond push-up", "close-grip push-up", "kneeling push-up (male)"],
      req
    );
    assert.ok(out.length >= 3);
    assertAllPass(out, req);
    for (const name of out) {
      const p = getExerciseProfile(findCatalogExercise(name)!);
      assert.equal(usesAnyEquipment(name), false, name);
      assert.ok(p.difficulty <= 1, name);
      assert.notEqual(p.pattern, "vertical_push", name);
    }
  });

  it("duration is a hard check", () => {
    const tooLong = {
      title: "Upper",
      description: "",
      coach_notes: [],
      exercises: Array.from({ length: 10 }, () => ({ ...ex("push-up", 5, "12"), rest_seconds: 120 })),
    };
    assert.ok(validateWorkoutDay(tooLong, req).hard.some((v) => v.code === "duration"));
  });
});

describe("20. 'Make it bodyweight only' → 'Actually I have dumbbells'", () => {
  it("the latest statement wins", () => {
    const req = resolveWorkoutRequirements(profile(), "", {
      conversation: ["Make it bodyweight only", "Actually I have dumbbells"],
    });
    assert.ok(req.equipment.allowedTags?.has("dumbbell"));
    const filter = exerciseFilterFromRequirements(req);
    assert.equal(exerciseRejection(findCatalogExercise("dumbbell goblet squat")!, filter), null);
  });

  it("reverse order goes back to strict bodyweight", () => {
    const req = resolveWorkoutRequirements(profile(), "", {
      conversation: ["I have dumbbells", "Actually make it bodyweight only"],
    });
    assert.ok(isStrictBodyweightConstraint(req.equipment));
  });
});

// ─── 14–15: nutrition ───────────────────────────────────────────────────────

function mealPlan(): AiGeneratedNutritionPlan {
  return {
    title: "Plan",
    description: "",
    daily_targets: { calories: 2200, protein: 160, carbs: 220, fat: 70 },
    meals: [
      { slot: "breakfast", name: "Greek yogurt bowl", calories: 450, protein: 35, carbs: 50, fat: 10, ingredients: [{ name: "Greek yogurt" }, { name: "whey protein" }, { name: "almond milk" }] },
      { slot: "lunch", name: "Chicken rice bowl", calories: 600, protein: 45, carbs: 70, fat: 15, ingredients: [{ name: "chicken breast" }, { name: "rice" }, { name: "chicken broth" }] },
      { slot: "dinner", name: "Salmon with potatoes", calories: 650, protein: 45, carbs: 60, fat: 22, ingredients: [{ name: "salmon fillet" }, { name: "butter" }, { name: "potatoes" }] },
    ],
    coach_notes: [],
    grocery_list: [{ name: "Chicken breast" }, { name: "Cheddar cheese" }, { name: "Rice" }],
  };
}

describe("14. diet without dairy", () => {
  const c = resolveNutritionConstraints({}, ["make me a diet without dairy"]);

  it("detects dairy including whey, butter and cheese — not almond milk", () => {
    assert.ok(c.categories.includes("dairy"));
    const items = findFoodViolations(mealPlan(), c).map((v) => v.item);
    for (const bad of ["Greek yogurt", "whey protein", "butter", "Cheddar cheese"]) assert.ok(items.includes(bad), bad);
    assert.ok(!items.includes("almond milk"));
  });

  it("auto-fix leaves zero violations", () => {
    const fixed = autoFixNutritionPlan(mealPlan(), c);
    assert.deepEqual(findFoodViolations(fixed.plan, c), []);
    assert.ok(fixed.plan.coach_notes[0]!.includes("Adjusted"));
  });
});

describe("15. diet without chicken", () => {
  const c = resolveNutritionConstraints({}, ["meal plan, no chicken please"]);

  it("catches chicken in any form (broth too)", () => {
    const items = findFoodViolations(mealPlan(), c).map((v) => v.item);
    for (const bad of ["Chicken rice bowl", "chicken breast", "chicken broth", "Chicken breast"]) assert.ok(items.includes(bad), bad);
  });

  it("auto-fix swaps to allowed protein", () => {
    const fixed = autoFixNutritionPlan(mealPlan(), c);
    assert.deepEqual(findFoodViolations(fixed.plan, c), []);
    const lunch = fixed.plan.meals.find((m) => m.slot === "lunch")!;
    assert.ok(!/chicken/i.test(JSON.stringify(lunch)));
  });

  it("no dairy + no chicken + no fish across turns all persist", () => {
    const all = resolveNutritionConstraints({}, ["no dairy", "also no chicken", "and I don't eat fish", "make it high protein"]);
    for (const id of ["dairy", "chicken", "fish"] as const) assert.ok(all.categories.includes(id), id);
    const fixed = autoFixNutritionPlan(mealPlan(), all);
    assert.deepEqual(findFoodViolations(fixed.plan, all), []);
  });

  it("allergies are never lifted by a casual request", () => {
    const allergic = resolveNutritionConstraints({ food_allergies: ["nuts"] }, ["add almonds"]);
    assert.ok(allergic.categories.includes("nuts"));
    assert.ok(allergic.notes.length > 0);
  });

  it("vegetarian + 'I eat chicken now' only lifts chicken", () => {
    const veg = resolveNutritionConstraints({ diet_type: "vegetarian" }, ["I eat chicken now"]);
    assert.ok(!veg.categories.includes("chicken"));
    assert.ok(veg.categories.includes("pork"));
    assert.ok(veg.categories.includes("fish"));
  });
});

// ─── Pipeline pieces ────────────────────────────────────────────────────────

describe("generate → enforce → validate → regenerate once", () => {
  it("regenerates with explicit feedback when the first attempt breaks hard rules", async () => {
    const req = resolveWorkoutRequirements(profile(), "bodyweight only chest workout");
    const feedbacks: (string | null)[] = [];
    const attempts = [
      ["dumbbell bench press", "dumbbell fly", "barbell bench press", "cable decline fly"],
      ["push-up", "wide hand push up", "diamond push-up", "close-grip push-up"],
    ];
    const result = await generateWithValidation({
      generate: async (feedback) => {
        feedbacks.push(feedback);
        return attempts[feedbacks.length - 1]!;
      },
      validateRaw: (names) => ({ ok: false, hard: validateExerciseNames(names, req).filter((v) => v.severity === "hard"), soft: [] }),
      enforce: (names) => {
        const enforced = enforceRequirementsOnExercises(names.map((n) => ex(n)), req);
        return { value: enforced.value.map((e) => e.name), repairCount: enforced.repairs.length, itemCount: names.length };
      },
      validate: (names) => {
        const v = validateExerciseNames(names, req);
        const hard = v.filter((x) => x.severity === "hard");
        return { ok: hard.length === 0, hard, soft: v.filter((x) => x.severity === "soft") };
      },
    });
    assert.equal(result.attempts, 2);
    assert.equal(feedbacks[0], null);
    assert.match(feedbacks[1]!, /dumbbell|equipment/i);
    assert.deepEqual(result.value, attempts[1]);
    assert.ok(result.report.ok);
  });
});

describe("weekly split focus sanitizing", () => {
  it("replaces leg days when legs are excluded and keeps the exact day count", () => {
    const req = resolveWorkoutRequirements(profile(), "4 day plan, don't train legs");
    const { focuses, replaced } = sanitizeDayFocuses(["Push", "Pull", "Legs", "Full body"], req, 4);
    assert.equal(focuses.length, 4);
    assert.ok(!focuses.some((f) => /leg|lower|full body/i.test(f)), focuses.join(", "));
    assert.equal(replaced.length, 2);
  });

  it("pads to the requested count", () => {
    const req = resolveWorkoutRequirements(profile(), "5 day plan");
    assert.equal(sanitizeDayFocuses(["Push", "Pull"], req, 5).focuses.length, 5);
  });
});

describe("chat context", () => {
  it("collects user turns and the latest workout preview (sanitized)", () => {
    const ctx = extractCoachChatContext(
      [
        { role: "user", content: "make me a push day, no equipment" },
        {
          role: "assistant",
          content: "done",
          planPreview: {
            type: "workout",
            plan: { kind: "strength", title: "Push", days: [{ title: "Push", exercises: [{ name: "push-up", sets: 3, reps: "10", rest_seconds: 60 }, { bogus: true }] }] },
          },
        },
      ],
      "remove the push-ups\n\n[Instruction: something]"
    );
    assert.deepEqual(ctx.userTurns, ["make me a push day, no equipment", "remove the push-ups"]);
    assert.equal(ctx.workingWorkout?.type, "strength");
    if (ctx.workingWorkout?.type === "strength") {
      assert.equal(ctx.workingWorkout.plan.days[0]!.exercises.length, 1);
    }
  });

  it("merges constraints across turns; request-scoped fields come from the latest turn only", () => {
    const c = constraintsFromConversation(["no squats", "chest focus today"], null);
    assert.ok(c.excluded_families.includes("squat"));
    const later = constraintsFromConversation(["chest focus today", "now a back workout"], null);
    assert.ok(!later.muscles_focus.includes("chest"));
  });
});

describe("tool guard", () => {
  it("alternatives question never mutates the plan", () => {
    const intent = classifyCoachIntent("what can I do instead of squats?", { hasExistingPlan: true });
    assert.equal(intent.primary, "alternatives");
    assert.ok(guardToolForIntent("replace_workout_exercise", intent, true));
    assert.equal(guardToolForIntent("get_my_active_plans", intent, true), null);
  });

  it("negations in slang are preserved", () => {
    const c = extractCoachConstraints("gimme a chest day w/o any bands, dont want shoulders");
    assert.ok(c.equipment.forbidTags.has("band") || c.equipment.forbidTags.has("resistance band"));
    assert.ok(c.muscles_avoid.includes("front_delts"));
  });
});
