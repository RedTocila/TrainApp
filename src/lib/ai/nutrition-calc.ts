/**
 * Deterministic nutrition math: ingredient → grams → nutrients, meal and day
 * totals, and portion fitting so the written plan matches its targets.
 * Pure — no LLM, no I/O.
 */

import { foodDisplayName, getFood, matchFood, matchFoods, type FoodItem, type FoodLang, type Nutrients } from "@/lib/ai/food-catalog";
import {
  formatPortion,
  gramsForAmount,
  parseAmount,
  parseAmountFromName,
  stateFromText,
} from "@/lib/ai/food-portions";
import type {
  AiGeneratedNutritionPlan,
  AiNutritionIngredient,
  AiNutritionMeal,
  AiNutritionTotals,
} from "@/lib/ai/plan-builder-types";

export type MacroTargets = { calories: number; protein: number; carbs: number; fat: number };

export const ZERO: Nutrients = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

export function roundNutrients(n: Nutrients): Nutrients {
  return {
    calories: Math.round(n.calories),
    protein: Math.round(n.protein),
    carbs: Math.round(n.carbs),
    fat: Math.round(n.fat),
    fiber: Math.round(n.fiber),
  };
}

function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  return {
    calories: per100.calories * f,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    fat: per100.fat * f,
    fiber: per100.fiber * f,
  };
}

// ─── Ingredient analysis ────────────────────────────────────────────────────

export type IngredientAnalysis = {
  ingredient: AiNutritionIngredient;
  food: FoodItem | null;
  grams: number;
  nutrients: Nutrients;
  /** True when grams or reference values were guessed. */
  estimated: boolean;
  raw: boolean;
};

const SEASONING_RE = /\b(?:salt|pepper to taste|spices?|herbs?|seasoning|to taste)\b/i;
const SAUCE_RE = /\b(?:sauce|dressing|pesto|gravy|marinade|glaze|dip)\b/i;
const VEG_RE = /\b(?:vegetables?|veg|greens|leaves|herbs)\b/i;

/** Rough per-100 g values for foods with no catalog entry — always marked estimated. */
function fallbackPer100(name: string): Nutrients {
  if (SEASONING_RE.test(name)) return { ...ZERO };
  if (SAUCE_RE.test(name)) return { calories: 150, protein: 2, carbs: 10, fat: 11, fiber: 1 };
  if (VEG_RE.test(name)) return { calories: 30, protein: 2, carbs: 5, fat: 0.3, fiber: 2.5 };
  return { calories: 150, protein: 8, carbs: 18, fat: 5, fiber: 2 };
}

export function resolveIngredientFood(ing: AiNutritionIngredient): FoodItem | null {
  if (ing.food) {
    const byId = getFood(ing.food) ?? matchFood(ing.food);
    if (byId) return byId;
  }
  return matchFood(ing.name);
}

export function analyzeIngredient(ing: AiNutritionIngredient): IngredientAnalysis {
  const food = resolveIngredientFood(ing);
  const parsed = parseAmount(ing.amount) ?? parseAmountFromName(ing.name);
  const text = `${ing.name} ${ing.amount ?? ""}`;
  if (!food) {
    const grams =
      parsed && (parsed.unit === "g" || parsed.unit === "ml")
        ? parsed.qty
        : parsed?.unit === "kg"
          ? parsed.qty * 1000
          : SEASONING_RE.test(ing.name)
            ? 1
            : 50;
    return {
      ingredient: ing,
      food: null,
      grams,
      nutrients: scaleNutrients(fallbackPer100(ing.name), grams),
      estimated: true,
      raw: false,
    };
  }
  const { grams, estimated } = gramsForAmount(food, parsed);
  const raw = stateFromText(text) === "raw" && Boolean(food.per100Raw);
  const per100 = raw ? food.per100Raw! : food.per100;
  return { ingredient: ing, food, grams, nutrients: scaleNutrients(per100, grams), estimated, raw };
}

export type MealAnalysis = {
  items: IngredientAnalysis[];
  total: Nutrients;
  estimated: boolean;
};

export function analyzeMeal(meal: AiNutritionMeal): MealAnalysis {
  const ingredients = meal.ingredients ?? [];
  if (!ingredients.length) {
    return {
      items: [],
      total: {
        calories: meal.calories || 0,
        protein: meal.protein || 0,
        carbs: meal.carbs || 0,
        fat: meal.fat || 0,
        fiber: meal.fiber ?? 0,
      },
      estimated: true,
    };
  }
  const items = ingredients.map(analyzeIngredient);
  return {
    items,
    total: items.reduce((acc, i) => addNutrients(acc, i.nutrients), { ...ZERO }),
    estimated: items.some((i) => i.estimated && (i.nutrients.calories > 25 || !i.food)),
  };
}

// ─── Plan recalculation ─────────────────────────────────────────────────────

/** Replace every meal's numbers with values computed from its foods; daily totals = sum of meals. */
export function recalculateNutritionPlan(plan: AiGeneratedNutritionPlan): AiGeneratedNutritionPlan {
  let anyEstimated = false;
  const meals = plan.meals.map((meal) => {
    const a = analyzeMeal(meal);
    anyEstimated ||= a.estimated;
    const r = roundNutrients(a.total);
    const ingredients = meal.ingredients?.map((ing, i) => {
      const food = a.items[i]?.food;
      return food && !ing.food ? { ...ing, food: food.id } : ing;
    });
    return {
      ...meal,
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      fiber: r.fiber,
      macro_source: a.estimated ? ("estimated" as const) : ("calculated" as const),
      ...(ingredients ? { ingredients } : {}),
    };
  });
  const daily_totals = meals.reduce<AiNutritionTotals>(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
      fiber: acc.fiber + (m.fiber ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
  return { ...plan, meals, daily_totals, nutrition_estimated: anyEstimated };
}

export function planTotals(plan: AiGeneratedNutritionPlan): AiNutritionTotals {
  return recalculateNutritionPlan(plan).daily_totals!;
}

/** Keep macro targets internally consistent (P×4 + C×4 + F×9 ≈ calories). */
export function consistentTargets(t: MacroTargets): MacroTargets {
  const calories = Math.round(t.calories);
  const protein = Math.round(t.protein);
  const fat = Math.round(t.fat);
  const fromMacros = protein * 4 + t.carbs * 4 + fat * 9;
  if (calories > 0 && Math.abs(fromMacros - calories) / calories <= 0.06) {
    return { calories, protein, carbs: Math.round(t.carbs), fat };
  }
  const carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

// ─── Portion fitting ────────────────────────────────────────────────────────

type Slot = { mealIndex: number; ingIndex: number; food: FoodItem; grams: number; raw: boolean };

type MealSlotId = AiGeneratedNutritionPlan["meals"][number]["slot"];

const MEAL_WEIGHTS: Record<MealSlotId, number> = {
  breakfast: 0.25,
  snack_1: 0.1,
  lunch: 0.32,
  snack_2: 0.1,
  dinner: 0.28,
};

/** Share of the day's calories each meal should roughly carry (normalized to the slots present). */
export function mealCalorieShares(slots: readonly MealSlotId[]): Map<MealSlotId, number> {
  const total = slots.reduce((acc, s) => acc + MEAL_WEIGHTS[s], 0) || 1;
  return new Map(slots.map((s) => [s, MEAL_WEIGHTS[s] / total]));
}

/** Meal kcal above this multiple of its share is flagged as unbalanced. */
export const MEAL_HEAVY_FACTOR = 1.6;

function perGram(food: FoodItem, raw: boolean): Nutrients {
  const p = raw && food.per100Raw ? food.per100Raw : food.per100;
  return scaleNutrients(p, 1);
}

function totalsOf(slots: Slot[], fixed: Nutrients): Nutrients {
  return slots.reduce(
    (acc, s) => addNutrients(acc, scaleNutrients(s.raw && s.food.per100Raw ? s.food.per100Raw : s.food.per100, s.grams)),
    fixed
  );
}

function contribution(slots: Slot[], pick: (s: Slot) => boolean, key: keyof Nutrients): number {
  return slots.filter(pick).reduce((acc, s) => acc + perGram(s.food, s.raw)[key] * s.grams, 0);
}

function minGrams(food: FoodItem): number {
  return Math.max(food.display === "piece" && food.units.piece ? food.units.piece * 0.5 : 0, food.serving * 0.35);
}

const isProteinSource = (s: Slot) => s.food.role === "protein";
const isCarbSource = (s: Slot) => s.food.role === "carb";
const isFatSource = (s: Slot) => s.food.role === "fat";

function applyFactor(slots: Slot[], pick: (s: Slot) => boolean, factor: number) {
  for (const s of slots) {
    if (!pick(s)) continue;
    s.grams = Math.min(s.food.maxPerMeal, Math.max(minGrams(s.food), s.grams * factor));
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type FitResult = { plan: AiGeneratedNutritionPlan; adjusted: string[] };

/**
 * Scale protein, fat and carb sources (vegetables, fruit and seasonings stay put)
 * so the written plan lands near the targets; amounts are re-rounded to real
 * portions and every number is recomputed from those portions.
 */
/**
 * Pull each meal toward its share of the day (carb/fat sources first, protein
 * only if still far off) so no single meal ends up carrying the whole day.
 */
function balanceMeals(slots: Slot[], fixedByMeal: number[], plan: AiGeneratedNutritionPlan, dayKcal: number) {
  const shares = mealCalorieShares(plan.meals.map((m) => m.slot));
  plan.meals.forEach((meal, mealIndex) => {
    const target = dayKcal * (shares.get(meal.slot) ?? 0);
    if (target <= 0) return;
    const inMeal = (s: Slot) => s.mealIndex === mealIndex;
    const mealKcal = () => fixedByMeal[mealIndex]! + contribution(slots, inMeal, "calories");
    for (const pass of [(s: Slot) => s.food.role !== "protein", () => true]) {
      const kcal = mealKcal();
      const pick = (s: Slot) => inMeal(s) && pass(s);
      const scalable = contribution(slots, pick, "calories");
      if (scalable <= 0) continue;
      const others = kcal - scalable;
      if (kcal > target * 1.25) applyFactor(slots, pick, clamp((target * 1.1 - others) / scalable, 0.4, 1));
      else if (kcal < target * 0.6) applyFactor(slots, pick, clamp((target * 0.8 - others) / scalable, 1, 1.6));
      else break;
    }
  });
}

export function fitPortionsToTargets(
  plan: AiGeneratedNutritionPlan,
  targets: MacroTargets,
  opts: { lang?: FoodLang } = {}
): FitResult {
  const lang = opts.lang ?? "en";
  const slots: Slot[] = [];
  let fixed: Nutrients = { ...ZERO };
  const fixedByMeal = plan.meals.map(() => 0);
  plan.meals.forEach((meal, mealIndex) => {
    const a = analyzeMeal(meal);
    if (!meal.ingredients?.length) {
      fixed = addNutrients(fixed, a.total);
      fixedByMeal[mealIndex] = a.total.calories;
      return;
    }
    a.items.forEach((item, ingIndex) => {
      const scalable = item.food && ["protein", "carb", "fat"].includes(item.food.role) && !item.estimated;
      if (scalable) slots.push({ mealIndex, ingIndex, food: item.food!, grams: item.grams, raw: item.raw });
      else {
        fixed = addNutrients(fixed, item.nutrients);
        fixedByMeal[mealIndex] = fixedByMeal[mealIndex]! + item.nutrients.calories;
      }
    });
  });
  if (!slots.length || targets.calories <= 0) return { plan: recalculateNutritionPlan(plan), adjusted: [] };

  const before = totalsOf(slots, fixed);
  const multiMeal = plan.meals.length > 1;
  const shares = mealCalorieShares(plan.meals.map((m) => m.slot));
  const mealTarget = plan.meals.map((m) => targets.calories * (shares.get(m.slot) ?? 0));
  const overShare = (mealIndex: number) =>
    multiMeal &&
    fixedByMeal[mealIndex]! + contribution(slots, (s) => s.mealIndex === mealIndex, "calories") > mealTarget[mealIndex]! * 1.1;

  /** Scale one food group toward a day target; growth goes to meals that still have room. */
  const scaleGroup = (pick: (s: Slot) => boolean, key: keyof Nutrients, target: number, lo: number, hi: number) => {
    const current = totalsOf(slots, fixed)[key];
    const src = contribution(slots, pick, key);
    if (src <= 0) return;
    const factor = clamp((target - (current - src)) / src, lo, hi);
    if (factor <= 1 || !multiMeal) {
      applyFactor(slots, pick, factor);
      return;
    }
    const roomy = (s: Slot) => pick(s) && !overShare(s.mealIndex);
    const roomySrc = contribution(slots, roomy, key);
    if (roomySrc > 0) applyFactor(slots, roomy, clamp((target - (current - roomySrc)) / roomySrc, lo, hi));
    // Still short: let the other meals grow, but stay under the "heavy meal" line.
    for (let mealIndex = 0; mealIndex < plan.meals.length; mealIndex++) {
      const now = totalsOf(slots, fixed)[key];
      if (now >= target * 0.98) break;
      const inMeal = (s: Slot) => pick(s) && s.mealIndex === mealIndex;
      const mealSrc = contribution(slots, inMeal, key);
      const mealPickKcal = contribution(slots, inMeal, "calories");
      if (mealSrc <= 0 || mealPickKcal <= 0) continue;
      const mealKcal = fixedByMeal[mealIndex]! + contribution(slots, (s) => s.mealIndex === mealIndex, "calories");
      const headroom = mealTarget[mealIndex]! * (MEAL_HEAVY_FACTOR - 0.15) - mealKcal;
      if (headroom <= 0) continue;
      const needed = 1 + (target - now) / mealSrc;
      applyFactor(slots, inMeal, clamp(Math.min(needed, 1 + headroom / mealPickKcal), 1, hi));
    }
  };

  for (let iter = 0; iter < 6; iter++) {
    if (multiMeal) balanceMeals(slots, fixedByMeal, plan, targets.calories);
    const t = totalsOf(slots, fixed);
    if (targets.protein > 0 && Math.abs(t.protein - targets.protein) / targets.protein > 0.05) {
      scaleGroup(isProteinSource, "protein", targets.protein, 0.6, 1.6);
    }
    const t2 = totalsOf(slots, fixed);
    if (targets.fat > 0 && Math.abs(t2.fat - targets.fat) / targets.fat > 0.12) {
      scaleGroup(isFatSource, "fat", targets.fat, 0.5, 1.8);
    }
    const t3 = totalsOf(slots, fixed);
    if (Math.abs(t3.calories - targets.calories) / targets.calories > 0.04) {
      scaleGroup(isCarbSource, "calories", targets.calories, 0.4, 2);
    }
    const t4 = totalsOf(slots, fixed);
    if (Math.abs(t4.calories - targets.calories) / targets.calories > 0.08) {
      scaleGroup(isFatSource, "calories", targets.calories, 0.5, 1.6);
    }
    for (const s of slots) s.grams = formatPortion(s.food, s.grams).grams;
  }

  const meals = plan.meals.map((meal) => ({ ...meal, ingredients: meal.ingredients?.map((i) => ({ ...i })) }));
  const adjusted: string[] = [];
  for (const s of slots) {
    const ing = meals[s.mealIndex]!.ingredients![s.ingIndex]!;
    const { amount } = formatPortion(s.food, s.grams, lang);
    const nextAmount = s.raw ? `${amount} ${rawMarker(lang)}` : amount;
    if (ing.amount !== nextAmount) adjusted.push(`${ing.name}: ${ing.amount ?? "?"} → ${nextAmount}`);
    ing.amount = nextAmount;
    ing.food = s.food.id;
  }
  const after = totalsOf(slots, fixed);
  if (Math.abs(after.calories - before.calories) < 1 && adjusted.length === 0) {
    return { plan: recalculateNutritionPlan(plan), adjusted: [] };
  }
  return { plan: recalculateNutritionPlan({ ...plan, meals }), adjusted };
}

/** Normalize one ingredient's amount to a clean catalog portion (keeps raw/dry marker). */
export function rawMarker(lang: FoodLang = "en"): string {
  return lang === "al" ? "(pa gatuar)" : "(raw)";
}

export function normalizeIngredientAmount(ing: AiNutritionIngredient, lang: FoodLang = "en"): AiNutritionIngredient {
  const a = analyzeIngredient(ing);
  if (!a.food) return ing;
  const { amount } = formatPortion(a.food, a.grams, lang);
  return { ...ing, amount: a.raw ? `${amount} ${rawMarker(lang)}` : amount, food: a.food.id };
}

/** Split "Greek yogurt with berries" style ingredients into one food each. */
export function splitCompoundIngredient(ing: AiNutritionIngredient, lang: FoodLang = "en"): AiNutritionIngredient[] {
  if (ing.food) return [ing];
  const matches = matchFoods(ing.name).filter((m) => m.food.group !== "seasoning");
  if (matches.length < 2 || !/\b(?:with|and|&|\+|plus|,)\b|[,&+]/.test(ing.name)) return [ing];
  const [first, ...rest] = matches;
  return [
    { name: foodDisplayName(first!.food, lang), amount: ing.amount, food: first!.food.id },
    ...rest.map((m) => ({ name: foodDisplayName(m.food, lang), amount: formatPortion(m.food, m.food.serving, lang).amount, food: m.food.id })),
  ];
}
