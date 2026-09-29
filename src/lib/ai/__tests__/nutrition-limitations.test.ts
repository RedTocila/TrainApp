/**
 * Follow-ups to the nutrition coach: USDA-backed catalog values, Albanian food
 * names, grounded semantic "allow", regional availability, per-meal balance and
 * multi-day menus.
 *
 * Run: npx tsx --test src/lib/ai/__tests__/nutrition-limitations.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FOOD_CATALOG, getFood } from "../food-catalog";
import { FOOD_REFERENCE } from "../food-reference";
import { FOOD_NAMES_SQ } from "../food-names-sq";
import { foodAvailability, resolveFoodRegion } from "../food-availability";
import { formatPortion, gramsForAmount, parseAmount } from "../food-portions";
import { changePortionInPlan, NutritionEditError, rankSubstitutes, swapFoodInPlan } from "../food-swap";
import { analyzeIngredient, analyzeMeal, MEAL_HEAVY_FACTOR, mealCalorieShares } from "../nutrition-calc";
import {
  findFoodViolations,
  foodTextAllowed,
  mergeSemanticConstraints,
  parseSemanticDietaryItems,
  resolveNutritionConstraints,
} from "../nutrition-constraints";
import {
  editAllDayMenus,
  planDayMenus,
  weeklyGroceryList,
  weeklyMenuOccurrences,
} from "../nutrition-day-variants";
import { buildNutritionRequest, finalizeNutritionPlan, selectMenuFoods, type NutritionRequest } from "../nutrition-pipeline";
import { formatNutritionPlanText, isUnsafeRawFood } from "../nutrition-quality";
import type { AiGeneratedNutritionPlan } from "../plan-builder-types";
import type { Profile } from "../../types";

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

const MEALS: FixtureMeal[] = [
  { slot: "breakfast", name: "Eggs, oats & banana", ingredients: [{ name: "eggs", amount: "3" }, { name: "oats", amount: "60g" }, { name: "banana", amount: "1" }] },
  { slot: "lunch", name: "Chicken, rice & broccoli", ingredients: [{ name: "chicken breast", amount: "150g" }, { name: "white rice", amount: "200g" }, { name: "broccoli", amount: "150g" }, { name: "olive oil", amount: "1 tbsp" }] },
  { slot: "snack_2", name: "Greek yogurt & berries", ingredients: [{ name: "Greek yogurt", amount: "200g" }, { name: "berries", amount: "100g" }] },
  { slot: "dinner", name: "Salmon, potatoes & salad", ingredients: [{ name: "salmon", amount: "150g" }, { name: "potatoes", amount: "300g" }, { name: "salad", amount: "100g" }] },
];

function finalize(meals: FixtureMeal[], req: NutritionRequest) {
  return finalizeNutritionPlan({ title: "Fixture plan", description: "", meals, coach_notes: [] }, req);
}

// ─── Catalog accuracy ──────────────────────────────────────────────────────

describe("catalog values come from USDA FoodData Central", () => {
  it("every reference entry maps to a catalog food, and USDA entries carry an FDC id", () => {
    for (const [id, ref] of Object.entries(FOOD_REFERENCE)) {
      const food = getFood(id);
      assert.ok(food, `reference id ${id} exists in catalog`);
      assert.deepEqual([food!.per100.calories, food!.per100.protein, food!.per100.carbs, food!.per100.fat, food!.per100.fiber], [...ref.per100]);
      if (ref.source === "usda") assert.ok(ref.fdcId && ref.fdcId > 100000, `${id} fdcId`);
    }
    const sourced = FOOD_CATALOG.filter((f) => f.source !== "label").length;
    assert.ok(sourced / FOOD_CATALOG.length > 0.9, `${sourced}/${FOOD_CATALOG.length} foods reference-backed`);
  });

  it("known reference points: cooked chicken breast 165 kcal / 31 g protein; raw 120 / 22.5", () => {
    const chicken = getFood("chicken_breast")!;
    assert.equal(chicken.per100.calories, 165);
    assert.equal(chicken.per100.protein, 31);
    assert.equal(chicken.fdcId, 171477);
    assert.equal(chicken.per100Raw?.calories, 120);
  });

  it("per-100 g values are internally consistent (Atwater within 15%)", () => {
    for (const f of FOOD_CATALOG) {
      const n = f.per100;
      if (n.calories < 40 || f.role === "condiment") continue;
      const atwater = n.protein * 4 + n.carbs * 4 + n.fat * 9;
      assert.ok(Math.abs(atwater - n.calories) / n.calories < 0.2, `${f.id}: ${n.calories} vs ${atwater.toFixed(0)}`);
    }
  });
});

// ─── Albanian names ─────────────────────────────────────────────────────────

describe("engine-added foods use the client's language", () => {
  it("every catalog food has an Albanian name", () => {
    const missing = FOOD_CATALOG.filter((f) => !FOOD_NAMES_SQ[f.id]).map((f) => f.id);
    assert.deepEqual(missing, []);
  });

  it("swap in an Albanian plan writes the Albanian name and an Albanian portion", () => {
    const req = buildNutritionRequest(profile({ preferred_locale: "al" } as Partial<Profile>));
    const { plan } = finalize(MEALS, req);
    const res = swapFoodInPlan(plan, { from: "chicken breast", slot: "lunch" }, { constraints: req.constraints, lang: "al", region: req.context.region });
    const change = res.changes[0]!;
    const food = getFood(res.plan.meals.find((m) => m.slot === "lunch")!.ingredients!.find((i) => i.name === change.to)!.food!)!;
    assert.equal(change.to, food.nameSq);
  });

  it("Albanian plan: replacements, added vegetables, grocery list and notes are in Albanian", () => {
    const req = buildNutritionRequest(profile({ preferred_locale: "al" } as Partial<Profile>), "pa bulmet", { conversation: ["pa bulmet"] });
    const meals: FixtureMeal[] = [
      { slot: "breakfast", name: "Vezë me tërshërë", ingredients: [{ name: "vezë", amount: "3" }, { name: "tërshërë", amount: "60g" }, { name: "qumësht", amount: "200ml" }] },
      { slot: "lunch", name: "Pulë me oriz", ingredients: [{ name: "gjoks pule", amount: "150g" }, { name: "oriz", amount: "200g" }] },
      { slot: "snack_2", name: "Kos me fruta", ingredients: [{ name: "kos grek", amount: "200g", food: "greek_yogurt" }, { name: "mollë", amount: "1", food: "apple" }] },
      { slot: "dinner", name: "Peshk me patate", ingredients: [{ name: "salmon", amount: "150g", food: "salmon" }, { name: "patate", amount: "300g", food: "potatoes" }, { name: "sallatë", amount: "100g", food: "salad" }] },
    ];
    const { plan } = finalize(meals, req);
    const written = new Set(meals.flatMap((m) => m.ingredients.map((i) => i.name)));
    const added = plan.meals.flatMap((m) => m.ingredients ?? []).filter((i) => !written.has(i.name));
    assert.ok(added.length >= 2, "dairy swaps and a lunch vegetable were added");
    for (const ing of added) {
      const food = getFood(ing.food ?? "");
      if (food?.nameSq) assert.ok(ing.name.startsWith(food.nameSq), `${ing.name} should be Albanian (${food.nameSq})`);
    }
    assert.ok(plan.grocery_list!.some((g) => /pule/i.test(g.name.normalize("NFD").replace(/\p{M}/gu, ""))), JSON.stringify(plan.grocery_list));
    assert.ok(plan.coach_notes.some((n) => /ushqime të plota/.test(n)), "whole-food note in Albanian");
  });

  it("Albanian portion words round-trip through the parser", () => {
    const bread = getFood("wholegrain_bread")!;
    const oil = getFood("olive_oil")!;
    const eggs = getFood("eggs")!;
    for (const [food, grams] of [[bread, 70], [oil, 14], [eggs, 150]] as const) {
      const p = formatPortion(food, grams, "al");
      const back = gramsForAmount(food, parseAmount(p.amount)).grams;
      assert.ok(Math.abs(back - p.grams) < 1, `${p.amount}: ${back} vs ${p.grams}`);
    }
    assert.equal(formatPortion(getFood("seasoning")!, 1, "al").amount, "sipas shijes");
  });

  it("raw animal foods in Albanian are caught", () => {
    assert.equal(isUnsafeRawFood("vezë të gjalla"), true);
    assert.equal(isUnsafeRawFood("mish i papjekur"), true);
    assert.equal(isUnsafeRawFood("vezë të ziera"), false);
  });
});

// ─── Semantic allow ─────────────────────────────────────────────────────────

describe("model 'allow' signals lift rules only when grounded", () => {
  const conversation = ["no fish please", "tani e ha peshkun përsëri"];
  const allowFish = parseSemanticDietaryItems({ items: [{ food: "fish", category: "fish", severity: "restriction", action: "allow" }] });

  it("the rule parser alone keeps fish out for the Albanian phrasing", () => {
    const base = resolveNutritionConstraints({}, conversation);
    assert.equal(foodTextAllowed("salmon", base), false);
  });

  it("a grounded allow (latest message mentions fish, no exclusion) lifts it", () => {
    const base = resolveNutritionConstraints({}, conversation);
    const merged = mergeSemanticConstraints(base, allowFish, { latestMessage: conversation.at(-1) });
    assert.equal(foodTextAllowed("salmon", merged), true);
  });

  it("an allow the latest message doesn't mention is ignored", () => {
    const base = resolveNutritionConstraints({}, ["no fish please", "can you make lunch bigger"]);
    const merged = mergeSemanticConstraints(base, allowFish, { latestMessage: "can you make lunch bigger" });
    assert.equal(foodTextAllowed("salmon", merged), false);
  });

  it("an allow contradicted by the latest message is ignored", () => {
    const base = resolveNutritionConstraints({}, ["no fish please", "still no fish"]);
    const merged = mergeSemanticConstraints(base, allowFish, { latestMessage: "still no fish" });
    assert.equal(foodTextAllowed("salmon", merged), false);
  });

  it("allergies are never lifted by the model", () => {
    const base = resolveNutritionConstraints({ food_allergies: ["shellfish"] }, ["shrimp is fine for me now"]);
    const items = parseSemanticDietaryItems({ items: [{ food: "shrimp", category: "shellfish", action: "allow" }] });
    const merged = mergeSemanticConstraints(base, items, { latestMessage: "shrimp is fine for me now" });
    assert.equal(foodTextAllowed("shrimp", merged), false);
    assert.ok(merged.allergyCategories.includes("shellfish"));
  });

  it("custom dislikes lift too (mushrooms)", () => {
    const base = resolveNutritionConstraints({}, ["no mushrooms", "mushrooms are back on for me"]);
    const items = parseSemanticDietaryItems({ items: [{ food: "mushrooms", action: "allow" }] });
    const merged = mergeSemanticConstraints(base, items, { latestMessage: "mushrooms are back on for me" });
    assert.equal(foodTextAllowed("mushrooms", merged), true);
  });

  it("vegetarian + allowed chicken keeps the rest of meat out", () => {
    const base = resolveNutritionConstraints({ diet_type: "vegetarian" }, ["ok chicken works for me these days"]);
    const items = parseSemanticDietaryItems({ items: [{ food: "chicken", category: "chicken", action: "allow" }] });
    const merged = mergeSemanticConstraints(base, items, { latestMessage: "ok chicken works for me these days" });
    assert.equal(foodTextAllowed("chicken breast", merged), true);
    assert.equal(foodTextAllowed("pork chops", merged), false);
    assert.equal(foodTextAllowed("salmon", merged), false);
  });
});

// ─── Regional availability ─────────────────────────────────────────────────

describe("location-aware food availability", () => {
  it("region comes from the conversation, else the app language", () => {
    assert.equal(resolveFoodRegion(["I live in Tirana"], "en"), "balkans");
    assert.equal(resolveFoodRegion(["jetoj në Prishtinë"], "en"), "balkans");
    assert.equal(resolveFoodRegion(["I'm in Chicago"], "al"), "north_america");
    assert.equal(resolveFoodRegion(["moved to London last year"], "al"), "western_europe");
    assert.equal(resolveFoodRegion([], "al"), "balkans");
    assert.equal(resolveFoodRegion(["hello"], "en"), "global");
  });

  it("region ids in the tables are real catalog foods", () => {
    for (const region of ["balkans", "north_america", "western_europe"] as const) {
      for (const f of FOOD_CATALOG) foodAvailability(f, region);
    }
    assert.equal(foodAvailability(getFood("tempeh")!, "balkans"), "rare");
    assert.equal(foodAvailability(getFood("cottage_cheese")!, "balkans"), "common");
  });

  it("Balkans menu skips rare/limited foods unless the client wants variety", () => {
    const simple = selectMenuFoods(buildNutritionRequest(profile({ preferred_locale: "al" } as Partial<Profile>)));
    const ids = new Set(simple.map((f) => f.id));
    for (const id of ["tempeh", "edamame", "quinoa", "sweet_potato", "tofu"]) assert.ok(!ids.has(id), `${id} not on a simple Balkans menu`);
    for (const id of ["feta", "trout", "cottage_cheese", "kidney_beans"]) assert.ok(ids.has(id), `${id} on the Balkans menu`);

    const variety = new Set(selectMenuFoods(buildNutritionRequest(profile({ preferred_locale: "al" } as Partial<Profile>), "more variety please")).map((f) => f.id));
    assert.ok(variety.has("quinoa") && !variety.has("tempeh"));
  });

  it("the same food ranks differently by region (US allows black beans / corn tortillas)", () => {
    const us = buildNutritionRequest(profile(), "I live in Texas");
    assert.equal(us.context.region, "north_america");
    const usIds = new Set(selectMenuFoods(us).map((f) => f.id));
    assert.ok(usIds.has("black_beans"));
    const top = rankSubstitutes(getFood("chicken_breast")!, { region: "balkans" }).slice(0, 5).map((x) => x.food.id);
    assert.ok(top.every((id) => foodAvailability(getFood(id)!, "balkans") !== "rare"), top.join(","));
  });

  it("the prompt tells the model where the client shops", () => {
    const req = buildNutritionRequest(profile(), "I live in Kosovo");
    assert.ok(req.context.summaryLines.some((l) => /Albania \/ Balkans/.test(l)));
  });
});

// ─── Meal balance ───────────────────────────────────────────────────────────

describe("portion fitting keeps each meal near its share of the day", () => {
  const HEAVY_BREAKFAST: FixtureMeal[] = [
    { slot: "breakfast", name: "Big breakfast", ingredients: [{ name: "oats", amount: "150g" }, { name: "peanut butter", amount: "3 tbsp" }, { name: "eggs", amount: "4" }, { name: "banana", amount: "2" }] },
    { slot: "lunch", name: "Chicken & salad", ingredients: [{ name: "chicken breast", amount: "80g" }, { name: "salad", amount: "100g" }] },
    { slot: "snack_2", name: "Apple", ingredients: [{ name: "apple", amount: "1" }] },
    { slot: "dinner", name: "Fish & greens", ingredients: [{ name: "white fish", amount: "100g" }, { name: "broccoli", amount: "150g" }, { name: "potatoes", amount: "100g" }] },
  ];

  it("a breakfast-heavy draft is rebalanced; day totals still land on target", () => {
    const req = buildNutritionRequest(profile(), "same meals every day");
    const { plan, issues } = finalize(HEAVY_BREAKFAST, req);
    const day = plan.daily_totals!.calories;
    const shares = mealCalorieShares(plan.meals.map((m) => m.slot));
    for (const meal of plan.meals) {
      assert.ok(meal.calories <= day * shares.get(meal.slot)! * MEAL_HEAVY_FACTOR, `${meal.slot} ${meal.calories} of ${day}`);
    }
    assert.ok(!issues.some((i) => i.code === "meal_unbalanced"), JSON.stringify(issues));
    assert.ok(Math.abs(day - req.context.targets.calories) / req.context.targets.calories <= 0.1, `${day} vs ${req.context.targets.calories}`);
  });

  it("shares are normalized to the chosen slots", () => {
    const three = mealCalorieShares(["breakfast", "lunch", "dinner"]);
    const sum = [...three.values()].reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.ok(three.get("lunch")! > three.get("breakfast")!);
  });
});

// ─── Multi-day menus ───────────────────────────────────────────────────────

function menuSignature(meals: AiGeneratedNutritionPlan["meals"]): string {
  return meals.map((m) => (m.ingredients ?? []).map((i) => analyzeIngredient(i).food?.id ?? i.name).sort().join(",")).join("|");
}

describe("multi-day menus", () => {
  it("default 'simple' style → 3 distinct daily menus, each on target and recalculated", () => {
    const req = buildNutritionRequest(profile());
    assert.equal(req.context.menuCount, 3);
    const { plan } = finalize(MEALS, req);
    const menus = planDayMenus(plan);
    assert.equal(menus.length, 3);
    assert.deepEqual(menus.map((m) => m.label), ["Day A", "Day B", "Day C"]);
    assert.equal(new Set(menus.map((m) => menuSignature(m.meals))).size, 3, "menus are distinct");
    for (const m of menus) {
      const t = m.daily_totals!;
      assert.ok(Math.abs(t.calories - req.context.targets.calories) / req.context.targets.calories <= 0.1, `${m.label}: ${t.calories}`);
      assert.equal(t.calories, m.meals.reduce((a, x) => a + x.calories, 0));
      for (const meal of m.meals) assert.ok(Math.abs(analyzeMeal(meal).total.calories - meal.calories) <= 1);
      assert.deepEqual(m.meals.map((x) => x.slot), req.context.slots);
    }
  });

  it("every menu respects the food rules", () => {
    const conversation = ["no dairy", "no chicken", "I hate broccoli"];
    const req = buildNutritionRequest(profile(), undefined, { conversation });
    const { plan } = finalize(MEALS, req);
    const menus = planDayMenus(plan);
    assert.ok(menus.length >= 2);
    for (const m of menus) assert.deepEqual(findFoodViolations({ ...plan, meals: m.meals }, req.constraints), [], m.label);
  });

  it("explicit counts win: '5 different menus', 'same meals every day'", () => {
    assert.equal(buildNutritionRequest(profile(), "give me 5 different menus").context.menuCount, 5);
    assert.equal(buildNutritionRequest(profile(), "same meals every day please").context.menuCount, 1);
    assert.equal(buildNutritionRequest(profile(), "different meals every day").context.menuCount, 7);
  });

  it("Albanian labels", () => {
    const req = buildNutritionRequest(profile({ preferred_locale: "al" } as Partial<Profile>));
    const { plan } = finalize(MEALS, req);
    assert.deepEqual(planDayMenus(plan).map((m) => m.label), ["Dita A", "Dita B", "Dita C"]);
  });

  it("grocery list weights each menu by how often it is eaten in the week", () => {
    assert.deepEqual(weeklyMenuOccurrences(3), [3, 2, 2]);
    assert.deepEqual(weeklyMenuOccurrences(1), [7]);
    const req = buildNutritionRequest(profile());
    const { plan } = finalize(MEALS, req);
    const occ = weeklyMenuOccurrences(planDayMenus(plan).length);
    const expectedBanana = planDayMenus(plan).reduce(
      (acc, m, i) =>
        acc +
        m.meals.flatMap((x) => x.ingredients ?? []).filter((ing) => analyzeIngredient(ing).food?.id === "banana").reduce((g, ing) => g + analyzeIngredient(ing).grams, 0) * occ[i]!,
      0
    );
    const listed = plan.grocery_list!.find((g) => /^banana/i.test(g.name));
    if (expectedBanana > 0) {
      assert.ok(listed, "banana on list");
      assert.equal(Number(listed!.amount), Math.ceil(expectedBanana / getFood("banana")!.units.piece! - 0.01));
    } else {
      assert.equal(listed, undefined);
    }
    assert.deepEqual(weeklyGroceryList(plan), plan.grocery_list);
  });

  it("swaps and portion changes apply to every menu that has the food", () => {
    const req = buildNutritionRequest(profile());
    const { plan } = finalize(MEALS, req);
    const res = editAllDayMenus(plan, (menu) => swapFoodInPlan(menu, { from: "oats" }, { constraints: req.constraints }));
    for (const m of planDayMenus(res.plan)) {
      assert.ok(!m.meals.flatMap((x) => x.ingredients ?? []).some((i) => analyzeIngredient(i).food?.id === "oats"), m.label);
      assert.equal(m.daily_totals!.calories, m.meals.reduce((a, x) => a + x.calories, 0));
    }
    const portion = editAllDayMenus(plan, (menu) => changePortionInPlan(menu, { food: "banana", amount: "2" }));
    assert.ok(portion.changes.length >= 1);
    assert.throws(
      () => editAllDayMenus(plan, (menu) => swapFoodInPlan(menu, { from: "caviar" }, {})),
      NutritionEditError
    );
  });

  it("plan text for the coach lists every menu", () => {
    const req = buildNutritionRequest(profile());
    const { plan } = finalize(MEALS, req);
    const text = formatNutritionPlanText(plan);
    for (const label of ["Day A", "Day B", "Day C"]) assert.match(text, new RegExp(`=== ${label} ===`));
  });

  it("very simple → one menu, no variants", () => {
    const req = buildNutritionRequest(profile(), "keep it super simple");
    const { plan } = finalize(MEALS, req);
    assert.equal(planDayMenus(plan).length, 1);
  });
});
