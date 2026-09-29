/**
 * Nutrition coach: the 20 required scenarios, run against the REAL deterministic
 * pipeline (request building, constraint parsing, food filtering, finalize/fix,
 * macro recalculation, swap/portion engine, validation).
 *
 * Where a model answer is needed, a scripted MODEL_FIXTURE stands in for the LLM
 * output. These tests prove what the code does with a given model answer — they
 * do NOT prove how the live model behaves. The live-model eval at the bottom runs
 * only with RUN_AI_EVALS=1 and an API key.
 *
 * Run: npx tsx --test src/lib/ai/__tests__/nutrition-coach.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FOOD_CATALOG, getFood, matchFood } from "../food-catalog";
import { formatPortion, gramsForAmount, parseAmount } from "../food-portions";
import { changePortionInPlan, rankSubstitutes, swapFoodInPlan } from "../food-swap";
import { analyzeIngredient, analyzeMeal, recalculateNutritionPlan } from "../nutrition-calc";
import {
  findFoodViolations,
  foodTextAllowed,
  mergeSemanticConstraints,
  parseSemanticDietaryItems,
  resolveNutritionConstraints,
} from "../nutrition-constraints";
import {
  buildNutritionPrompt,
  buildNutritionRequest,
  finalizeNutritionPlan,
  runNutritionPipeline,
  selectMenuFoods,
  type NutritionRequest,
} from "../nutrition-pipeline";
import { formatNutritionPlanText, isUnsafeRawFood } from "../nutrition-quality";
import { planDayMenus, weeklyMenuOccurrences } from "../nutrition-day-variants";
import { classifyCoachIntent } from "../coach-intent";
import { guardToolForIntent } from "../coach-chat-tool-guard";
import type { AiGeneratedNutritionPlan } from "../plan-builder-types";
import type { Profile } from "../../types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function profile(overrides: Partial<Profile> = {}, responses: Record<string, unknown> = {}): Profile {
  return {
    id: "test",
    age: 30,
    gender: "male",
    height_cm: 180,
    intake_weight_kg: 80,
    goal: "build_muscle",
    intake_responses: {
      diet_type: "omnivore",
      meals_per_day: "4",
      cooking_frequency: "sometimes",
      training_days_per_week: "4_5",
      ...responses,
    },
    ...overrides,
  } as unknown as Profile;
}

type FixtureMeal = { slot: string; name: string; description?: string; ingredients: { name: string; amount?: string; food?: string }[] };

/** MODEL_FIXTURE: a scripted LLM answer (JSON) — stands in for the model. */
function modelFixture(meals: FixtureMeal[], notes: string[] = []): unknown {
  return { title: "Fixture plan", description: "", meals, coach_notes: notes };
}

/** A typical, decent model answer for the default 4-slot profile. */
const DECENT_4_MEALS: FixtureMeal[] = [
  { slot: "breakfast", name: "Eggs, oats & banana", ingredients: [{ name: "eggs", amount: "3" }, { name: "oats", amount: "60g" }, { name: "banana", amount: "1" }] },
  { slot: "lunch", name: "Chicken, rice & broccoli", ingredients: [{ name: "chicken breast", amount: "150g" }, { name: "white rice", amount: "200g" }, { name: "broccoli", amount: "150g" }, { name: "olive oil", amount: "1 tbsp" }] },
  { slot: "snack_2", name: "Greek yogurt & berries", ingredients: [{ name: "Greek yogurt", amount: "200g" }, { name: "berries", amount: "100g" }] },
  { slot: "dinner", name: "Salmon, potatoes & salad", ingredients: [{ name: "salmon", amount: "150g" }, { name: "potatoes", amount: "300g" }, { name: "salad", amount: "100g" }] },
];

function finalize(meals: FixtureMeal[], req: NutritionRequest) {
  return finalizeNutritionPlan(modelFixture(meals), req);
}

function allIngredientNames(plan: AiGeneratedNutritionPlan): string[] {
  return plan.meals.flatMap((m) => (m.ingredients ?? []).map((i) => i.name));
}

function catalogFoodsIn(plan: AiGeneratedNutritionPlan) {
  return plan.meals.flatMap((m) => (m.ingredients ?? []).map((i) => analyzeIngredient(i).food).filter(Boolean));
}

function assertTotalsConsistent(plan: AiGeneratedNutritionPlan) {
  const t = plan.daily_totals!;
  assert.ok(t, "daily_totals present");
  assert.equal(t.calories, plan.meals.reduce((a, m) => a + m.calories, 0), "day kcal = sum of meals");
  assert.equal(t.protein, plan.meals.reduce((a, m) => a + m.protein, 0), "day protein = sum of meals");
  for (const meal of plan.meals) {
    const a = analyzeMeal(meal);
    assert.ok(Math.abs(a.total.calories - meal.calories) <= 1, `${meal.slot} kcal recomputed from foods`);
  }
}

/** MODEL_FIXTURE generator: returns scripted answers in order and records prompts. */
function scriptedModel(answers: (unknown | Error)[]) {
  const prompts: string[] = [];
  let i = 0;
  return {
    prompts,
    generate: async (prompt: string) => {
      prompts.push(prompt);
      const a = answers[Math.min(i++, answers.length - 1)];
      if (a instanceof Error) throw a;
      return JSON.stringify(a);
    },
  };
}

// ─── 1. Whole-food-first ────────────────────────────────────────────────────

describe("1. whole-food-first", () => {
  it("menu offered to the model has no highly processed foods, drinks or processed meats", () => {
    const req = buildNutritionRequest(profile());
    const menu = selectMenuFoods(req);
    assert.ok(menu.length > 30);
    assert.ok(menu.every((f) => f.processing !== "highly_processed"), "no highly processed");
    assert.ok(!menu.some((f) => ["ham", "bacon", "sausage", "salami", "soda", "orange_juice"].includes(f.id)));
    assert.ok(menu.some((f) => f.id === "eggs") && menu.some((f) => f.id === "oats"));
  });

  it("a decent plan is ≥75% whole/minimally processed calories and gets the whole-food note (not fear-based)", () => {
    const req = buildNutritionRequest(profile());
    const { plan, issues } = finalize(DECENT_4_MEALS, req);
    assert.ok(!issues.some((i) => i.code === "low_whole_food_share"));
    assert.ok(plan.coach_notes.some((n) => /whole and minimally processed/i.test(n)));
    assert.ok(!plan.coach_notes.some((n) => /toxic|poison|chemicals/i.test(n)));
  });

  it("minimally processed is fine: frozen veg, canned beans, plain yogurt, whole-grain bread stay", () => {
    const req = buildNutritionRequest(profile());
    const { plan } = finalize(
      [
        { slot: "breakfast", name: "Toast & yogurt", ingredients: [{ name: "whole-grain bread", amount: "2 slices" }, { name: "plain yogurt", amount: "200g" }, { name: "apple", amount: "1" }] },
        { slot: "lunch", name: "Beans & rice", ingredients: [{ name: "canned black beans", amount: "200g" }, { name: "rice", amount: "200g" }, { name: "frozen mixed vegetables", amount: "150g" }] },
        { slot: "snack_2", name: "Milk & banana", ingredients: [{ name: "milk", amount: "300ml" }, { name: "banana", amount: "1" }] },
        { slot: "dinner", name: "Turkey & potatoes", ingredients: [{ name: "turkey breast", amount: "150g" }, { name: "potatoes", amount: "300g" }, { name: "green beans", amount: "150g" }] },
      ],
      req
    );
    const ids = catalogFoodsIn(plan).map((f) => f!.id);
    for (const id of ["wholegrain_bread", "yogurt", "black_beans", "mixed_vegetables", "milk"]) {
      assert.ok(ids.includes(id), `${id} kept`);
    }
  });

  it("raw meat / raw eggs are never kept", () => {
    const req = buildNutritionRequest(profile());
    const { plan, issues } = finalize(
      [
        { slot: "breakfast", name: "Raw egg shake", ingredients: [{ name: "raw eggs", amount: "3" }, { name: "oats", amount: "60g" }, { name: "banana", amount: "1" }] },
        { slot: "lunch", name: "Steak tartare & potatoes", ingredients: [{ name: "steak tartare", amount: "150g" }, { name: "potatoes", amount: "250g" }, { name: "salad", amount: "100g" }] },
        ...DECENT_4_MEALS.slice(2),
      ],
      req
    );
    const texts = plan.meals.flatMap((m) => [m.name, m.description ?? "", ...(m.ingredients ?? []).map((i) => i.name)]);
    assert.ok(!texts.some(isUnsafeRawFood), texts.join(" | "));
    assert.ok(!issues.some((i) => i.code === "unsafe_raw"));
    assert.match(buildNutritionPrompt(req), /never raw meat, raw fish, raw eggs/);
  });
});

// ─── 2. No highly processed foods ───────────────────────────────────────────

describe("2. no highly processed foods", () => {
  it("unrequested bars, soda, chips, sausage and whey are swapped for whole foods", () => {
    const req = buildNutritionRequest(profile());
    const { plan, issues } = finalize(
      [
        { slot: "breakfast", name: "Cereal & shake", ingredients: [{ name: "sugary cereal", amount: "60g" }, { name: "whey protein", amount: "1 scoop" }, { name: "milk", amount: "250ml" }] },
        { slot: "lunch", name: "Sausage & chips", ingredients: [{ name: "sausage", amount: "150g" }, { name: "chips", amount: "50g" }, { name: "salad", amount: "100g" }] },
        { slot: "snack_2", name: "Protein bar & cola", ingredients: [{ name: "protein bar", amount: "1" }, { name: "cola", amount: "330ml" }] },
        DECENT_4_MEALS[3]!,
      ],
      req
    );
    const foods = catalogFoodsIn(plan);
    assert.ok(foods.every((f) => f!.processing !== "highly_processed"), foods.map((f) => f!.id).join(","));
    assert.ok(!issues.some((i) => i.code === "highly_processed"));
    assert.ok(plan.coach_notes.some((n) => /highly processed items for whole foods/i.test(n)));
  });

  it("allowed when the client explicitly asks (e.g. a protein shake after training)", () => {
    const req = buildNutritionRequest(profile(), "I want a protein shake after training");
    assert.ok(req.context.allowedProcessedIds.has("protein_powder"));
    const { plan } = finalize(
      [
        ...DECENT_4_MEALS.slice(0, 2),
        { slot: "snack_2", name: "Protein shake & banana", ingredients: [{ name: "whey protein", amount: "1 scoop" }, { name: "banana", amount: "1" }] },
        DECENT_4_MEALS[3]!,
      ],
      req
    );
    assert.ok(catalogFoodsIn(plan).some((f) => f!.id === "protein_powder"), "requested shake kept");
  });
});

// ─── 3. No dairy (+ the five natural phrasings) ─────────────────────────────

describe("3. no dairy", () => {
  const phrasings = [
    "No milk",
    "I don't drink milk",
    "Milk doesn't work for me",
    "Keep dairy out",
    "I can't have dairy",
  ];
  for (const text of phrasings) {
    it(`"${text}" excludes milk`, () => {
      const c = resolveNutritionConstraints({}, [text]);
      assert.equal(foodTextAllowed("milk", c), false, JSON.stringify(c));
      assert.equal(foodTextAllowed("almond milk", c), true, "plant milk still fine");
    });
  }

  it("dairy is removed everywhere (whey, butter, cheese, yogurt) while almond milk / peanut butter stay", () => {
    const req = buildNutritionRequest(profile(), "no dairy please");
    const { plan } = finalize(
      [
        { slot: "breakfast", name: "Oats with milk & peanut butter", ingredients: [{ name: "oats", amount: "60g" }, { name: "milk", amount: "250ml" }, { name: "peanut butter", amount: "1 tbsp" }, { name: "almond milk", amount: "100ml" }] },
        { slot: "lunch", name: "Chicken, rice & cheese", ingredients: [{ name: "chicken breast", amount: "150g" }, { name: "rice", amount: "200g" }, { name: "cheddar cheese", amount: "30g" }, { name: "broccoli", amount: "150g" }] },
        { slot: "snack_2", name: "Greek yogurt & berries", ingredients: [{ name: "Greek yogurt", amount: "200g" }, { name: "berries", amount: "100g" }] },
        { slot: "dinner", name: "Salmon & buttered potatoes", ingredients: [{ name: "salmon", amount: "150g" }, { name: "potatoes", amount: "300g" }, { name: "butter", amount: "1 tbsp" }, { name: "salad", amount: "100g" }] },
      ],
      req
    );
    assert.deepEqual(findFoodViolations(plan, req.constraints), []);
    const names = allIngredientNames(plan).join(" | ").toLowerCase();
    assert.match(names, /peanut butter/);
    assert.doesNotMatch(names, /almond olive oil|peanut olive oil/, "safe phrases are not mangled");
    assert.ok(plan.coach_notes.some((n) => /Adjusted to your food rules/.test(n)));
  });
});

// ─── 4. No chicken ──────────────────────────────────────────────────────────

describe("4. no chicken", () => {
  it("chicken in any form is replaced by another protein; portion matched", () => {
    const req = buildNutritionRequest(profile(), "no chicken");
    const { plan } = finalize(
      [
        DECENT_4_MEALS[0]!,
        { slot: "lunch", name: "Chicken, rice & broccoli", ingredients: [{ name: "grilled chicken breast", amount: "150g" }, { name: "rice", amount: "200g" }, { name: "broccoli", amount: "150g" }] },
        DECENT_4_MEALS[2]!,
        { slot: "dinner", name: "Chicken soup", ingredients: [{ name: "chicken thigh", amount: "150g" }, { name: "chicken broth", amount: "300ml" }, { name: "potatoes", amount: "250g" }, { name: "carrot", amount: "100g" }] },
      ],
      req
    );
    assert.deepEqual(findFoodViolations(plan, req.constraints), []);
    const lunch = plan.meals.find((m) => m.slot === "lunch")!;
    const protein = lunch.ingredients!.map((i) => analyzeIngredient(i).food).find((f) => f?.role === "protein");
    assert.ok(protein && protein.id !== "chicken_breast", "lunch still has a protein");
    assert.doesNotMatch(lunch.name.toLowerCase(), /chicken/);
  });
});

// ─── 5. No eggs ─────────────────────────────────────────────────────────────

describe("5. no eggs", () => {
  it("eggs are removed and breakfast keeps a breakfast-style protein", () => {
    const req = buildNutritionRequest(profile(), "no eggs");
    const { plan } = finalize(DECENT_4_MEALS, req);
    assert.deepEqual(findFoodViolations(plan, req.constraints), []);
    const breakfast = plan.meals.find((m) => m.slot === "breakfast")!;
    const foods = breakfast.ingredients!.map((i) => analyzeIngredient(i).food);
    assert.ok(!foods.some((f) => f?.id === "eggs" || f?.id === "egg_whites"));
    const protein = foods.find((f) => f?.role === "protein");
    assert.ok(protein, "breakfast has a protein");
    assert.ok(!["sardines", "tuna", "salmon", "lean_beef"].includes(protein!.id), `breakfast-appropriate: ${protein!.id}`);
  });
});

// ─── 6. Multiple restrictions ───────────────────────────────────────────────

describe("6. multiple restrictions", () => {
  it("no dairy + no gluten + no eggs all hold in the final plan; oats become certified GF", () => {
    const req = buildNutritionRequest(profile(), "no dairy, no gluten and no eggs");
    for (const id of ["dairy", "gluten", "eggs"]) assert.ok(req.constraints.categories.includes(id as never), id);
    const { plan } = finalize(
      [
        DECENT_4_MEALS[0]!,
        { slot: "lunch", name: "Chicken wrap", ingredients: [{ name: "chicken breast", amount: "150g" }, { name: "wholewheat wrap", amount: "1" }, { name: "cheese", amount: "30g" }, { name: "salad", amount: "100g" }] },
        DECENT_4_MEALS[2]!,
        { slot: "dinner", name: "Pasta & beef", ingredients: [{ name: "pasta", amount: "200g" }, { name: "lean beef", amount: "150g" }, { name: "tomato sauce", amount: "100g" }, { name: "spinach", amount: "100g" }] },
      ],
      req
    );
    assert.deepEqual(findFoodViolations(plan, req.constraints), []);
    const oats = allIngredientNames(plan).find((n) => /oats/i.test(n));
    if (oats) assert.match(oats, /gluten-free/i);
  });
});

// ─── 7. Allergy ─────────────────────────────────────────────────────────────

describe("7. allergy", () => {
  it("profile allergy is severity=allergy, never lifted by a casual request, and enforced", () => {
    const p = profile({}, { food_allergies: ["nuts"] });
    const req = buildNutritionRequest(p, "add almonds to my snack", { conversation: ["add almonds to my snack"] });
    assert.ok(req.constraints.allergyCategories.includes("nuts"));
    assert.ok(req.constraints.rules?.some((r) => r.id === "nuts" && r.severity === "allergy"));
    assert.ok(req.constraints.notes.length > 0, "coach is told the allergy stays");
    const { plan } = finalize(
      [...DECENT_4_MEALS.slice(0, 2), { slot: "snack_2", name: "Apple & almonds", ingredients: [{ name: "apple", amount: "1" }, { name: "almonds", amount: "30g" }] }, DECENT_4_MEALS[3]!],
      req
    );
    assert.deepEqual(findFoodViolations(plan, req.constraints), []);
  });

  it("the model can't invent an allergy: semantic 'allergy' is downgraded to intolerance", () => {
    const base = resolveNutritionConstraints({}, ["milk doesn't sit well with me"]);
    const items = parseSemanticDietaryItems({ items: [{ food: "milk", category: "dairy", severity: "allergy", action: "exclude" }] });
    const merged = mergeSemanticConstraints(base, items);
    assert.ok(!merged.allergyCategories.includes("dairy"));
    assert.ok(!merged.rules?.some((r) => r.severity === "allergy"));
  });
});

// ─── 8. Intolerance ─────────────────────────────────────────────────────────

describe("8. intolerance", () => {
  for (const text of ["I'm lactose intolerant", "milk upsets my stomach", "dairy makes me bloated"]) {
    it(`"${text}" → intolerance (excluded, but not an allergy)`, () => {
      const c = resolveNutritionConstraints({}, [text]);
      assert.equal(foodTextAllowed("milk", c), false);
      assert.ok(c.rules?.some((r) => r.severity === "intolerance"), JSON.stringify(c.rules));
      assert.deepEqual(c.allergyCategories, []);
    });
  }
});

// ─── 9. Dislike ─────────────────────────────────────────────────────────────

describe("9. dislike", () => {
  it("'I hate mushrooms' → dislike, avoided in the plan, not treated as allergy", () => {
    const req = buildNutritionRequest(profile(), "I hate mushrooms", { conversation: ["I hate mushrooms"] });
    assert.ok(req.constraints.rules?.some((r) => /mushroom/.test(r.id) && r.severity === "dislike"), JSON.stringify(req.constraints.rules));
    assert.deepEqual(req.constraints.allergyCategories, []);
    const { plan } = finalize(
      [DECENT_4_MEALS[0]!, { slot: "lunch", name: "Beef, rice & mushrooms", ingredients: [{ name: "lean beef", amount: "150g" }, { name: "rice", amount: "200g" }, { name: "mushrooms", amount: "100g" }] }, ...DECENT_4_MEALS.slice(2)],
      req
    );
    assert.ok(!allIngredientNames(plan).some((n) => /mushroom/i.test(n)));
  });
});

// ─── 10. Substitution ───────────────────────────────────────────────────────

describe("10. substitution", () => {
  const base = () => finalize(DECENT_4_MEALS, buildNutritionRequest(profile())).plan;

  it("named swap: rice → potatoes, portion re-sized by carbs, meal renamed", () => {
    const res = swapFoodInPlan(base(), { from: "rice", to: "potatoes" });
    const lunch = res.plan.meals.find((m) => m.slot === "lunch")!;
    assert.ok(lunch.ingredients!.some((i) => analyzeIngredient(i).food?.id === "potatoes"));
    assert.ok(!lunch.ingredients!.some((i) => analyzeIngredient(i).food?.id === "white_rice"));
    assert.doesNotMatch(lunch.name.toLowerCase(), /rice/);
    const potatoes = lunch.ingredients!.find((i) => analyzeIngredient(i).food?.id === "potatoes")!;
    assert.ok(analyzeIngredient(potatoes).grams > 200, "more grams of potato to match rice carbs");
  });

  it("auto swap respects food rules and keeps the role (protein → protein)", () => {
    const req = buildNutritionRequest(profile(), "no dairy, no fish");
    const res = swapFoodInPlan(base(), { from: "chicken breast" }, { constraints: req.constraints });
    const change = res.changes[0]!;
    const food = matchFood(change.to)!;
    assert.equal(food.role, "protein");
    assert.ok(foodTextAllowed(change.to, req.constraints), change.to);
  });

  it("a banned replacement is refused", () => {
    const req = buildNutritionRequest(profile(), "no dairy");
    assert.throws(() => swapFoodInPlan(base(), { from: "chicken", to: "cheese" }, { constraints: req.constraints }), /food rules/);
  });

  it("substitute ranking prefers whole foods and nutritionally similar options", () => {
    const whey = getFood("protein_powder")!;
    const top = rankSubstitutes(whey).slice(0, 3).map((x) => x.food);
    assert.ok(top.every((f) => f.processing !== "highly_processed"));
    assert.ok(top.every((f) => f.role === "protein"));
  });
});

// ─── 11. Macro recalculation after substitution ─────────────────────────────

describe("11. macro recalculation after substitution", () => {
  it("meal and day totals are recomputed from the new food; no 'may change' language", () => {
    const before = finalize(DECENT_4_MEALS, buildNutritionRequest(profile())).plan;
    const res = swapFoodInPlan(before, { from: "salmon", to: "chicken breast" });
    assertTotalsConsistent(res.plan);
    const dinnerBefore = before.meals.find((m) => m.slot === "dinner")!;
    const dinnerAfter = res.plan.meals.find((m) => m.slot === "dinner")!;
    assert.ok(dinnerAfter.fat < dinnerBefore.fat, "chicken is leaner than salmon → dinner fat drops");
    assert.match(res.summary, /Totals recalculated/);
    assert.match(res.summary, /Day now: ~?\d+ kcal/);
    assert.doesNotMatch(res.summary, /may change|approximate/i);
  });
});

// ─── 12. Portion recalculation ──────────────────────────────────────────────

describe("12. portion recalculation", () => {
  const base = () => finalize(DECENT_4_MEALS, buildNutritionRequest(profile())).plan;

  it("4 eggs instead of 3 adds exactly one egg's macros", () => {
    const plan = base();
    const eggs = plan.meals[0]!.ingredients!.find((i) => analyzeIngredient(i).food?.id === "eggs")!;
    const egg = getFood("eggs")!;
    const count = Math.round(analyzeIngredient(eggs).grams / egg.units.piece!);
    const res = changePortionInPlan(plan, { food: "eggs", amount: `${count + 1} eggs` });
    const diff = res.plan.daily_totals!.calories - plan.daily_totals!.calories;
    const oneEgg = (egg.per100.calories * egg.units.piece!) / 100;
    assert.ok(Math.abs(diff - oneEgg) <= 2, `one egg ≈ ${oneEgg} kcal, got ${diff}`);
    assertTotalsConsistent(res.plan);
  });

  it("'double the rice' doubles the grams and recalculates", () => {
    const plan = base();
    const rice = plan.meals.find((m) => m.slot === "lunch")!.ingredients!.find((i) => analyzeIngredient(i).food?.id === "white_rice")!;
    const res = changePortionInPlan(plan, { food: "rice", amount: "double" });
    const after = res.plan.meals.find((m) => m.slot === "lunch")!.ingredients!.find((i) => analyzeIngredient(i).food?.id === "white_rice")!;
    const ratio = analyzeIngredient(after).grams / analyzeIngredient(rice).grams;
    assert.ok(ratio > 1.8 && ratio <= 2.05, `ratio ${ratio}`);
    assert.ok(res.plan.daily_totals!.carbs > plan.daily_totals!.carbs);
    assertTotalsConsistent(res.plan);
  });

  it("'200g rice' sets an absolute amount", () => {
    const res = changePortionInPlan(base(), { food: "rice", amount: "200g" });
    const rice = res.plan.meals.find((m) => m.slot === "lunch")!.ingredients!.find((i) => analyzeIngredient(i).food?.id === "white_rice")!;
    assert.equal(Math.round(analyzeIngredient(rice).grams), 200);
  });
});

// ─── 13. Simple plan ────────────────────────────────────────────────────────

describe("13. simple plan", () => {
  it("default meals have ≤4 foods, short names, no multi-step recipes; output text is scannable", () => {
    const req = buildNutritionRequest(profile());
    assert.equal(req.context.style.complexity, "simple");
    const { plan } = finalize(
      [
        {
          slot: "breakfast",
          name: "Protein pancakes with berries, chia, nut butter, maple and yogurt sauce",
          description: "Whisk the eggs, then fold in the oats. Simmer for 3 minutes, then garnish with berries and drizzle maple.",
          ingredients: [
            { name: "eggs", amount: "3" }, { name: "oats", amount: "60g" }, { name: "Greek yogurt", amount: "100g" }, { name: "berries", amount: "100g" },
            { name: "chia seeds", amount: "1 tbsp" }, { name: "almond butter", amount: "1 tbsp" }, { name: "maple syrup", amount: "1 tbsp" },
          ],
        },
        ...DECENT_4_MEALS.slice(1),
      ],
      req
    );
    const breakfast = plan.meals[0]!;
    const real = analyzeMeal(breakfast).items.filter((i) => i.food?.group !== "seasoning");
    assert.ok(real.length <= 4, `breakfast has ${real.length} foods`);
    assert.ok(breakfast.name.length <= 48, breakfast.name);
    assert.ok(!/then|whisk|simmer/i.test(breakfast.description ?? ""));
    const text = formatNutritionPlanText(plan);
    assert.match(text, /^MEAL 1 — Breakfast:/m);
    assert.match(text, /^ {2}\d large eggs$/m);
    assert.match(text, /^ {2}\d+g oats$/m);
    assert.match(text, /^DAY TOTAL: ~?\d+ kcal/m);
  });
});

// ─── 14. No unnecessary ingredients ─────────────────────────────────────────

describe("14. no unnecessary ingredients", () => {
  it("'very simple' → ≤3 foods per meal; extra vegetables merged; garnish/sweeteners dropped first", () => {
    const req = buildNutritionRequest(profile(), "make it very simple");
    assert.equal(req.context.style.complexity, "very_simple");
    const { plan } = finalize(
      [
        DECENT_4_MEALS[0]!,
        {
          slot: "lunch",
          name: "Chicken bowl",
          ingredients: [
            { name: "chicken breast", amount: "150g" }, { name: "rice", amount: "200g" }, { name: "broccoli", amount: "80g" },
            { name: "bell pepper", amount: "50g" }, { name: "carrot", amount: "50g" }, { name: "honey", amount: "1 tbsp" }, { name: "salt and pepper" },
          ],
        },
        ...DECENT_4_MEALS.slice(2),
      ],
      req
    );
    for (const meal of plan.meals) {
      const real = analyzeMeal(meal).items.filter((i) => i.food?.group !== "seasoning");
      assert.ok(real.length <= 3, `${meal.slot}: ${real.map((r) => r.ingredient.name).join(", ")}`);
    }
    const lunch = plan.meals.find((m) => m.slot === "lunch")!;
    assert.ok(!lunch.ingredients!.some((i) => /honey/i.test(i.name)), "sweetener dropped before core foods");
    assert.ok(lunch.ingredients!.some((i) => analyzeIngredient(i).food?.role === "protein"));
  });
});

// ─── 15. Beginner plan ──────────────────────────────────────────────────────

describe("15. beginner plan", () => {
  it("rare cook, no meal count → quick, simple, 4 meals (never forced 6); plan matches the structure", async () => {
    const p = profile({}, { meals_per_day: undefined, cooking_frequency: "rarely", training_experience: "beginner" });
    const req = buildNutritionRequest(p, "I'm new to this, make me a meal plan");
    assert.equal(req.context.style.quick, true);
    assert.equal(req.context.slots.length, 4);
    const model = scriptedModel([modelFixture(DECENT_4_MEALS)]);
    const result = await runNutritionPipeline(req, { generate: model.generate });
    assert.deepEqual(result.plan.meals.map((m) => m.slot), req.context.slots);
    assert.match(model.prompts[0]!, /Keep prep under ~15 minutes/);
  });
});

// ─── 16. Existing profile ───────────────────────────────────────────────────

describe("16. existing profile", () => {
  it("uses saved targets, meal count and diet — no need to ask again", () => {
    const p = profile(
      { target_calories: 2100, target_protein: 150, target_carbs: 220, target_fat: 70 } as Partial<Profile>,
      { diet_type: "vegetarian", meals_per_day: "3", food_dislikes: "olives" }
    );
    const req = buildNutritionRequest(p);
    assert.equal(req.context.targetSource, "profile");
    assert.equal(req.context.targets.calories, 2100);
    assert.equal(req.context.targets.protein, 150);
    assert.deepEqual(req.context.slots, ["breakfast", "lunch", "dinner"]);
    assert.equal(foodTextAllowed("chicken", req.constraints), false, "vegetarian from profile");
    assert.equal(foodTextAllowed("olives", req.constraints), false, "dislike from profile");
    const { plan } = finalize(
      [
        { slot: "breakfast", name: "Eggs & oats", ingredients: [{ name: "eggs", amount: "3" }, { name: "oats", amount: "60g" }, { name: "banana", amount: "1" }] },
        { slot: "lunch", name: "Lentils & rice", ingredients: [{ name: "lentils", amount: "250g" }, { name: "rice", amount: "150g" }, { name: "salad", amount: "100g" }] },
        { slot: "dinner", name: "Tofu stir fry", ingredients: [{ name: "firm tofu", amount: "200g" }, { name: "rice noodles", amount: "150g" }, { name: "broccoli", amount: "150g" }, { name: "olives", amount: "30g" }] },
      ],
      req
    );
    assert.deepEqual(plan.daily_targets, req.context.targets);
    assert.ok(Math.abs(plan.daily_totals!.calories - 2100) / 2100 <= 0.1, `day ${plan.daily_totals!.calories} kcal`);
    assert.ok(!allIngredientNames(plan).some((n) => /olive(?!\s*oil)/i.test(n)));
  });
});

// ─── 17. More variety ───────────────────────────────────────────────────────

describe("17. more variety", () => {
  it("'more variety' → variety style and several distinct daily menus", () => {
    const req = buildNutritionRequest(profile(), "I want more variety");
    assert.equal(req.context.style.complexity, "variety");
    assert.ok(req.context.menuCount >= 4);
    const { plan } = finalize(DECENT_4_MEALS, req);
    const menus = planDayMenus(plan);
    assert.ok(menus.length >= 3, `menus: ${menus.length}`);
    const lunchProteins = new Set(
      menus.map((m) =>
        (m.meals.find((x) => x.slot === "lunch")?.ingredients ?? [])
          .map((i) => analyzeIngredient(i).food)
          .find((f) => f?.role === "protein")?.id
      )
    );
    assert.ok(lunchProteins.size >= 3, [...lunchProteins].join(", "));
    assert.ok(plan.coach_notes.some((n) => /rotate through the week/.test(n)));
    assert.match(buildNutritionPrompt(req), /MORE VARIETY/);
  });

  it("'same meals every day' → one menu with protein rotation ideas", () => {
    const req = buildNutritionRequest(profile(), "same meals every day please");
    assert.equal(req.context.menuCount, 1);
    const { plan } = finalize(DECENT_4_MEALS, req);
    assert.equal(planDayMenus(plan).length, 1);
    const rotation = plan.coach_notes.find((n) => /^Rotate proteins/.test(n));
    assert.ok(rotation, "rotation note present");
  });
});

// ─── 18. Meal prep ──────────────────────────────────────────────────────────

describe("18. meal prep", () => {
  it("'meal prep' → batch-cooking rules; grocery list is weekly and matches the meals", () => {
    const req = buildNutritionRequest(profile(), "I meal prep on Sundays");
    assert.equal(req.context.style.complexity, "meal_prep");
    assert.match(buildNutritionPrompt(req), /MEAL PREP/);
    const { plan } = finalize(DECENT_4_MEALS, req);
    const menus = planDayMenus(plan);
    assert.equal(menus.length, 2);
    const occurrences = weeklyMenuOccurrences(menus.length);
    const weeklyKg =
      menus.reduce((sum, m, k) => {
        const grams = m.meals
          .flatMap((x) => x.ingredients ?? [])
          .filter((i) => analyzeIngredient(i).food?.id === "chicken_breast")
          .reduce((g, i) => g + analyzeIngredient(i).grams, 0);
        return sum + grams * occurrences[k]!;
      }, 0) / 1000;
    const item = plan.grocery_list!.find((g) => /chicken/i.test(g.name))!;
    assert.ok(item, "chicken on grocery list");
    const amount = item.amount ?? "";
    const listed = parseFloat(amount) / (/kg/.test(amount) ? 1 : 1000);
    assert.ok(/k?g/.test(amount) && Math.abs(listed - weeklyKg) <= 0.15, `${amount} vs ${weeklyKg.toFixed(2)} kg`);
  });
});

// ─── 19. Constraint change mid-conversation ─────────────────────────────────

describe("19. constraint change mid-conversation", () => {
  it("a later message lifts an earlier exclusion ('actually I eat fish again')", () => {
    const req = buildNutritionRequest(profile(), undefined, { conversation: ["no fish please", "actually I eat fish again"] });
    assert.equal(foodTextAllowed("salmon", req.constraints), true);
  });

  it("a new rule added later applies to the next plan; earlier rules persist", async () => {
    const conversation = ["no dairy", "make me a meal plan", "also no chicken from now on"];
    const req = buildNutritionRequest(profile(), undefined, { conversation });
    assert.equal(foodTextAllowed("milk", req.constraints), false);
    assert.equal(foodTextAllowed("chicken", req.constraints), false);
    const model = scriptedModel([modelFixture(DECENT_4_MEALS)]);
    const result = await runNutritionPipeline(req, { generate: model.generate });
    assert.deepEqual(findFoodViolations(result.plan, req.constraints), []);
    assert.match(model.prompts[0]!, /also no chicken from now on/, "raw client message reaches the model");
  });

  it("swaps after the change still respect all rules", () => {
    const req = buildNutritionRequest(profile(), undefined, { conversation: ["no dairy", "no fish either"] });
    const plan = finalize(DECENT_4_MEALS, req).plan;
    const res = swapFoodInPlan(plan, { from: "chicken breast" }, { constraints: req.constraints });
    assert.deepEqual(findFoodViolations(res.plan, req.constraints), []);
  });
});

// ─── 20. Multiple simultaneous constraints ──────────────────────────────────

describe("20. multiple simultaneous constraints", () => {
  const message = "vegetarian, no dairy, no gluten, 3 meals a day, budget friendly, high protein";

  it("all settings are extracted at once", () => {
    const req = buildNutritionRequest(profile(), message, { conversation: [message] });
    assert.deepEqual(req.context.slots, ["breakfast", "lunch", "dinner"]);
    assert.equal(req.context.style.budget, true);
    assert.ok(req.context.targets.protein >= 150, `protein ${req.context.targets.protein}`);
    for (const t of ["chicken", "milk", "bread"]) assert.equal(foodTextAllowed(t, req.constraints), false, t);
    const menu = selectMenuFoods(req);
    assert.ok(menu.every((f) => f.cost < 3), "budget menu");
  });

  it("a failing first model answer is fixed or regenerated with feedback; final plan is valid", async () => {
    const req = buildNutritionRequest(profile(), message, { conversation: [message] });
    const bad = modelFixture([
      { slot: "breakfast", name: "Toast & cheese", ingredients: [{ name: "white bread", amount: "2 slices" }, { name: "cheese", amount: "40g" }] },
      { slot: "lunch", name: "Chicken pasta", ingredients: [{ name: "chicken", amount: "150g" }, { name: "pasta", amount: "200g" }] },
      { slot: "snack_2", name: "Protein bar", ingredients: [{ name: "protein bar", amount: "1" }] },
    ]);
    const good = modelFixture([
      { slot: "breakfast", name: "Tofu scramble & potatoes", ingredients: [{ name: "firm tofu", amount: "200g" }, { name: "potatoes", amount: "200g" }, { name: "spinach", amount: "80g" }] },
      { slot: "lunch", name: "Lentils, rice & vegetables", ingredients: [{ name: "lentils", amount: "250g" }, { name: "rice", amount: "200g" }, { name: "mixed vegetables", amount: "150g" }] },
      { slot: "dinner", name: "Chickpeas, quinoa & salad", ingredients: [{ name: "chickpeas", amount: "250g" }, { name: "quinoa", amount: "180g" }, { name: "salad", amount: "100g" }, { name: "olive oil", amount: "1 tbsp" }] },
    ]);
    const model = scriptedModel([bad, good]);
    const result = await runNutritionPipeline(req, { generate: model.generate });
    assert.deepEqual(findFoodViolations(result.plan, result.request.constraints), []);
    assert.deepEqual(result.plan.meals.map((m) => m.slot), ["breakfast", "lunch", "dinner"]);
    assert.ok(catalogFoodsIn(result.plan).every((f) => f!.processing !== "highly_processed"));
    assertTotalsConsistent(result.plan);
    if (result.attempts === 2) assert.match(model.prompts[1]!, /FAILED THESE CHECKS/);
  });
});

// ─── Pipeline behaviour, catalog and chat routing ───────────────────────────

describe("pipeline + catalog + routing", () => {
  it("semantic pass adds exclusions the rules missed (and runs alongside generation)", async () => {
    const req = buildNutritionRequest(profile(), undefined, { conversation: ["cow's juice is a no-go for me"] });
    const model = scriptedModel([modelFixture(DECENT_4_MEALS)]);
    const result = await runNutritionPipeline(req, {
      generate: model.generate,
      extractSemantic: async () => [{ food: "milk", category: "dairy", severity: "intolerance", action: "exclude" }],
    });
    assert.equal(foodTextAllowed("milk", result.request.constraints), false);
    assert.deepEqual(findFoodViolations(result.plan, result.request.constraints), []);
  });

  it("first model call fails → retry succeeds; both fail → error", async () => {
    const req = buildNutritionRequest(profile());
    const ok = await runNutritionPipeline(req, { generate: scriptedModel([new Error("timeout"), modelFixture(DECENT_4_MEALS)]).generate });
    assert.equal(ok.attempts, 2);
    await assert.rejects(runNutritionPipeline(req, { generate: scriptedModel([new Error("x"), new Error("y")]).generate }));
  });

  it("targets are never below a safe floor and deficits are removed for pregnancy", () => {
    const low = buildNutritionRequest(profile({ gender: "female" } as Partial<Profile>), "give me an 800 calorie diet");
    assert.ok(low.context.targets.calories >= 1200);
    assert.ok(low.context.safetyNotes.length > 0);
    const preg = buildNutritionRequest(profile({ gender: "female", goal: "lose_weight" } as Partial<Profile>), "I'm pregnant and want to lose weight");
    assert.ok(preg.context.safetyNotes.some((n) => /doctor|midwife|dietitian/i.test(n)));
  });

  it("every catalog food has a processing level and sane per-100g macros", () => {
    for (const f of FOOD_CATALOG) {
      assert.ok(["whole", "minimally_processed", "processed", "highly_processed"].includes(f.processing), f.id);
      const kcal = f.per100.protein * 4 + f.per100.carbs * 4 + f.per100.fat * 9;
      if (f.per100.calories > 40) assert.ok(Math.abs(kcal - f.per100.calories) / f.per100.calories < 0.3, `${f.id}: ${kcal} vs ${f.per100.calories}`);
    }
  });

  it("formatted portions parse back to the same grams for every food (no drift across edits)", () => {
    for (const f of FOOD_CATALOG) {
      if (f.group === "seasoning") continue;
      const { amount, grams } = formatPortion(f, f.serving);
      const back = gramsForAmount(f, parseAmount(amount)).grams;
      assert.ok(Math.abs(back - grams) / Math.max(grams, 1) <= 0.05, `${f.id}: "${amount}" → ${back}g vs ${grams}g`);
    }
  });

  it("chat routing: nutrition questions don't rebuild the plan; swap requests aren't blocked", () => {
    const q = classifyCoachIntent("why is there so much rice in my plan?", { hasExistingPlan: true });
    assert.ok(guardToolForIntent("edit_nutrition_plan", q, true));
    assert.ok(guardToolForIntent("generate_nutrition_plan", q, true));
    const swap = classifyCoachIntent("can you swap the rice for potatoes?", { hasExistingPlan: true });
    assert.equal(swap.primary, "modify_nutrition");
    assert.equal(guardToolForIntent("swap_food", swap, true), null);
    assert.ok(guardToolForIntent("generate_nutrition_plan", swap, true), "don't regenerate for a swap");
  });

  it("recalculation from a saved plan without food ids works (DB round-trip)", () => {
    const plan = finalize(DECENT_4_MEALS, buildNutritionRequest(profile())).plan;
    const stripped: AiGeneratedNutritionPlan = {
      ...plan,
      daily_totals: undefined,
      meals: plan.meals.map((m) => ({ ...m, calories: 0, protein: 0, carbs: 0, fat: 0, ingredients: m.ingredients!.map((i) => ({ name: i.name, amount: i.amount })) })),
    };
    const again = recalculateNutritionPlan(stripped);
    assert.equal(again.daily_totals!.calories, plan.daily_totals!.calories);
  });
});

// ─── Live model eval (opt-in) ───────────────────────────────────────────────

const RUN_EVALS = process.env.RUN_AI_EVALS === "1" && Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);

describe("live model eval (RUN_AI_EVALS=1)", { skip: !RUN_EVALS && "set RUN_AI_EVALS=1 with an API key to run" }, () => {
  it("real generator: 'Milk doesn't work for me', 3 meals, simple → valid, dairy-free, whole-food plan", { timeout: 120_000 }, async () => {
    const { generateNutritionPlanFromProfile } = await import("../generate-nutrition-plan");
    const text = "Milk doesn't work for me. 3 meals a day, keep it simple.";
    const p = profile();
    const plan = await generateNutritionPlanFromProfile(p, text, { conversation: [text] });
    const req = buildNutritionRequest(p, text, { conversation: [text] });
    assert.deepEqual(findFoodViolations(plan, req.constraints), []);
    assert.equal(plan.meals.length, 3);
    assert.ok(catalogFoodsIn(plan).every((f) => f!.processing !== "highly_processed"));
    assertTotalsConsistent(plan);
    assert.ok(Math.abs(plan.daily_totals!.calories - req.context.targets.calories) / req.context.targets.calories <= 0.12);
  });
});
