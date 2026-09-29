/**
 * Multi-day menus: derive Day B, C… from the validated Day A by rotating the
 * protein, carb and vegetable/fruit of each meal to macro-matched, allowed,
 * locally available foods. Every menu is re-fitted to the same targets and
 * recalculated from its own foods. Pure.
 */

import type { FoodLang } from "@/lib/ai/food-catalog";
import { isPracticalMenuFood } from "@/lib/ai/food-availability";
import { NutritionEditError, rotationOptions, type NutritionEditResult } from "@/lib/ai/food-swap";
import { analyzeIngredient, fitPortionsToTargets, recalculateNutritionPlan } from "@/lib/ai/nutrition-calc";
import { findFoodViolations } from "@/lib/ai/nutrition-constraints";
import {
  buildGroceryListForMenus,
  ensureFatSource,
  ensureVegetables,
  normalizePortions,
  simplifyMeals,
  type QualityContext,
} from "@/lib/ai/nutrition-quality";
import { getFood } from "@/lib/ai/food-catalog";
import type {
  AiGeneratedNutritionPlan,
  AiNutritionDayMenu,
  AiNutritionIngredient,
  AiNutritionMeal,
} from "@/lib/ai/plan-builder-types";

const LETTERS = "ABCDEFG";

export function dayMenuLabel(index: number, lang: FoodLang = "en"): string {
  return `${lang === "al" ? "Dita" : "Day"} ${LETTERS[index] ?? index + 1}`;
}

/** How many times each menu is eaten in a 7-day week when menus rotate A, B, C, A… */
export function weeklyMenuOccurrences(menuCount: number, days = 7): number[] {
  const n = Math.max(1, menuCount);
  return Array.from({ length: n }, (_, k) => Math.floor(days / n) + (k < days % n ? 1 : 0));
}

/** Menus in rotation order: Day A (the plan's own meals) first, then the variants. */
export function planDayMenus(plan: AiGeneratedNutritionPlan): AiNutritionDayMenu[] {
  return [
    {
      label: plan.day_label ?? "Day A",
      meals: plan.meals,
      daily_totals: plan.daily_totals,
      nutrition_estimated: plan.nutrition_estimated,
    },
    ...(plan.day_variants ?? []),
  ];
}

/** Menu index for the i-th scheduled date (round-robin). */
export function menuIndexForDate(dateIndex: number, menuCount: number): number {
  return menuCount > 0 ? dateIndex % menuCount : 0;
}

const ROTATED_ROLES = new Set(["protein", "carb", "vegetable", "fruit"]);

type UsedBySlotRole = Map<string, Set<string>>;

function rotateMeal(
  meal: AiNutritionMeal,
  ctx: QualityContext,
  used: UsedBySlotRole,
  lang: FoodLang,
  dayFoods: Set<string>
): { meal: AiNutritionMeal; changed: number } {
  const allowLimited = ctx.style.complexity === "variety" || ctx.style.complexity === "recipes";
  const practical = { region: ctx.region ?? "global", allowLimited, budget: ctx.style.budget, requested: ctx.requestedFoodIds };
  const mealFoodIds = new Set(
    (meal.ingredients ?? []).map((i) => analyzeIngredient(i).food?.id).filter((x): x is string => Boolean(x))
  );
  // Meal prep keeps breakfast and snacks fixed and only rotates the batch-cooked meals.
  const rotateSlot = ctx.style.complexity !== "meal_prep" || meal.slot === "lunch" || meal.slot === "dinner";
  let changed = 0;
  const ingredients = (meal.ingredients ?? []).map((ing): AiNutritionIngredient => {
    const a = analyzeIngredient(ing);
    if (!rotateSlot || !a.food || !ROTATED_ROLES.has(a.food.role)) return ing;
    const key = `${meal.slot}:${a.food.role}`;
    const seen = used.get(key) ?? new Set<string>([a.food.id]);
    used.set(key, seen);
    const options = rotationOptions(ing, {
      constraints: ctx.constraints,
      preferCheap: ctx.style.budget,
      quick: ctx.style.quick,
      allowProcessedIds: ctx.allowedProcessedIds,
      slot: meal.slot,
      lang,
      region: ctx.region,
      excludeIds: mealFoodIds,
      avoidIds: dayFoods,
      count: 10,
    }).filter((o) => {
      const f = getFood(o.food);
      return f ? isPracticalMenuFood(f, practical) : false;
    });
    if (!options.length) return ing;
    const pick = options.find((o) => !seen.has(o.food)) ?? options[seen.size % options.length]!;
    seen.add(pick.food);
    mealFoodIds.add(pick.food);
    dayFoods.add(pick.food);
    changed++;
    return { name: pick.name, amount: pick.amount, food: pick.food };
  });
  if (!changed) return { meal, changed };
  // Old wording would name foods that are no longer there; simplifyMeals rebuilds a plain name.
  return { meal: { ...meal, name: "", description: "", ingredients }, changed };
}

/**
 * Build `menuCount - 1` additional daily menus. Menus that break a food rule,
 * duplicate Day A, or miss the calorie target by more than 10% are dropped.
 */
export function buildDayVariants(
  plan: AiGeneratedNutritionPlan,
  ctx: QualityContext,
  menuCount: number
): AiNutritionDayMenu[] {
  if (menuCount <= 1 || !plan.meals.length) return [];
  const lang = ctx.lang ?? "en";
  const used: UsedBySlotRole = new Map();
  const variants: AiNutritionDayMenu[] = [];
  const signatures = new Set([signature(plan.meals)]);

  for (let k = 1; k < menuCount; k++) {
    let changedTotal = 0;
    const dayFoods = new Set<string>();
    const meals = plan.meals.map((meal) => {
      const r = rotateMeal(meal, ctx, used, lang, dayFoods);
      changedTotal += r.changed;
      return r.meal;
    });
    if (!changedTotal) break;
    let draft: AiGeneratedNutritionPlan = { ...plan, meals, day_variants: undefined };
    draft = simplifyMeals(draft, ctx).plan;
    draft = ensureVegetables(draft, ctx).plan;
    draft = ensureFatSource(draft, ctx).plan;
    draft = normalizePortions(draft, lang).plan;
    draft = fitPortionsToTargets(draft, ctx.targets, { lang }).plan;
    draft = recalculateNutritionPlan(draft);

    const sig = signature(draft.meals);
    const totals = draft.daily_totals;
    const kcalOff = totals && ctx.targets.calories > 0 ? Math.abs(totals.calories - ctx.targets.calories) / ctx.targets.calories : 0;
    if (signatures.has(sig) || findFoodViolations(draft, ctx.constraints).length || kcalOff > 0.1) continue;
    signatures.add(sig);
    variants.push({
      label: dayMenuLabel(variants.length + 1, lang),
      meals: draft.meals,
      daily_totals: draft.daily_totals,
      nutrition_estimated: draft.nutrition_estimated,
    });
  }
  return variants;
}

function signature(meals: readonly AiNutritionMeal[]): string {
  return meals
    .map((m) => `${m.slot}:${(m.ingredients ?? []).map((i) => analyzeIngredient(i).food?.id ?? i.name).sort().join(",")}`)
    .join("|");
}

/** Weekly grocery list across all menus, weighted by how often each is eaten. */
export function weeklyGroceryList(plan: AiGeneratedNutritionPlan, lang: FoodLang = "en") {
  const menus = planDayMenus(plan);
  const occurrences = weeklyMenuOccurrences(menus.length);
  return buildGroceryListForMenus(
    menus.map((m, i) => ({ plan: { ...plan, meals: m.meals }, days: occurrences[i]! })),
    lang
  );
}

/**
 * Run a surgical edit (swap / portion) on every daily menu. Menus that don't
 * contain the food are left as they are; it only fails if no menu changed.
 */
export function editAllDayMenus(
  plan: AiGeneratedNutritionPlan,
  edit: (menuPlan: AiGeneratedNutritionPlan) => NutritionEditResult
): NutritionEditResult {
  if (!plan.day_variants?.length) return edit(plan);
  const menus = planDayMenus(plan);
  let firstError: unknown = null;
  const results = menus.map((menu) => {
    try {
      return edit({ ...plan, meals: menu.meals, day_variants: undefined });
    } catch (err) {
      if (!(err instanceof NutritionEditError)) throw err;
      firstError ??= err;
      return null;
    }
  });
  if (results.every((r) => r === null)) throw firstError;
  const [head, ...rest] = results;
  const base = head?.plan ?? { ...plan, day_variants: undefined };
  const next: AiGeneratedNutritionPlan = {
    ...base,
    day_label: plan.day_label,
    day_variants: plan.day_variants.map((v, i) => {
      const r = rest[i];
      return r
        ? { label: v.label, meals: r.plan.meals, daily_totals: r.plan.daily_totals, nutrition_estimated: r.plan.nutrition_estimated }
        : v;
    }),
  };
  return {
    plan: next,
    changes: results.flatMap((r) => r?.changes ?? []),
    summary: results
      .map((r, i) => (r ? `${menus[i]!.label}: ${r.summary}` : null))
      .filter(Boolean)
      .join("\n"),
  };
}
