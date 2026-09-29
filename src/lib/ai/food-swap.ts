/**
 * Food substitution engine + surgical nutrition edits (swap a food, change a
 * portion). Every edit recalculates meal and day totals from the actual foods.
 * Pure — no LLM, no I/O.
 */

import {
  FOOD_CATALOG,
  foodDisplayName,
  getFood,
  matchFood,
  normalizeFoodText,
  type FoodItem,
  type FoodLang,
  type FoodRole,
} from "@/lib/ai/food-catalog";
import { foodAvailability, regionalCost, type FoodRegion } from "@/lib/ai/food-availability";
import { formatPortion, parseAmount, gramsForAmount } from "@/lib/ai/food-portions";
import { analyzeIngredient, rawMarker, recalculateNutritionPlan } from "@/lib/ai/nutrition-calc";
import {
  foodTextAllowed,
  hasNutritionConstraints,
  type NutritionConstraints,
} from "@/lib/ai/nutrition-constraints";
import type { AiGeneratedNutritionPlan, AiNutritionIngredient, AiNutritionMeal } from "@/lib/ai/plan-builder-types";

export class NutritionEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NutritionEditError";
  }
}

export type SwapOptions = {
  constraints?: NutritionConstraints | null;
  excludeIds?: ReadonlySet<string>;
  preferCheap?: boolean;
  quick?: boolean;
  /** Highly processed foods the client explicitly asked for. */
  allowProcessedIds?: ReadonlySet<string>;
  /** Meal the food sits in — breakfast/snacks prefer breakfast-style proteins. */
  slot?: AiNutritionMeal["slot"] | null;
  /** Language for food names written into the plan. */
  lang?: FoodLang;
  /** Where the client shops — drives availability and cost. */
  region?: FoodRegion;
  /** Foods already used elsewhere in the day — allowed, but ranked lower. */
  avoidIds?: ReadonlySet<string>;
};

const AVAILABILITY_SCORE = { common: 5, limited: -8, rare: -40 } as const;

const BREAKFAST_PROTEINS = new Set([
  "eggs",
  "egg_whites",
  "greek_yogurt",
  "yogurt",
  "cottage_cheese",
  "soy_yogurt",
  "coconut_yogurt",
  "tofu",
  "turkey_slices",
  "milk",
  "soy_milk",
  "cheese",
  "feta",
  "mozzarella",
  "edamame",
  "peanut_butter",
  "almond_butter",
]);

const BREAKFAST_CARBS = new Set([
  "oats",
  "wholegrain_bread",
  "white_bread",
  "gf_bread",
  "wholewheat_wrap",
  "rice_cakes",
  "muesli",
  "buckwheat",
  "corn_tortilla",
]);

function isLightSlot(slot: SwapOptions["slot"]): boolean {
  return slot === "breakfast" || slot === "snack_1" || slot === "snack_2";
}

export function isFoodAllowed(food: FoodItem, c?: NutritionConstraints | null): boolean {
  if (!c || !hasNutritionConstraints(c)) return true;
  if (food.tags.some((t) => c.categories.includes(t))) return false;
  return foodTextAllowed(food.name, c) && food.aliases.slice(0, 1).every((a) => foodTextAllowed(a, c));
}

const ROLE_COMPAT: Partial<Record<FoodRole, FoodRole[]>> = {
  protein: ["protein"],
  carb: ["carb"],
  fat: ["fat"],
  vegetable: ["vegetable"],
  fruit: ["fruit"],
  mixed: ["mixed", "protein"],
  beverage: ["beverage", "fruit"],
  treat: ["fruit", "protein", "fat", "carb"],
  condiment: ["condiment"],
};

function macroShares(f: FoodItem): [number, number, number] {
  const n = f.per100;
  const kcal = n.protein * 4 + n.carbs * 4 + n.fat * 9 || 1;
  return [(n.protein * 4) / kcal, (n.carbs * 4) / kcal, (n.fat * 9) / kcal];
}

function scoreSubstitute(from: FoodItem, to: FoodItem, opts: SwapOptions): number {
  const compat = ROLE_COMPAT[from.role] ?? [from.role];
  const roleIdx = compat.indexOf(to.role);
  if (roleIdx < 0) return -Infinity;
  let score = roleIdx === 0 ? 40 : 15;
  if (to.group === from.group) score += 10;
  const [p1, c1, f1] = macroShares(from);
  const [p2, c2, f2] = macroShares(to);
  score -= 30 * (Math.abs(p1 - p2) + Math.abs(c1 - c2) + Math.abs(f1 - f2));
  if (from.role === "protein") {
    const d1 = from.per100.protein / Math.max(1, from.per100.calories);
    const d2 = to.per100.protein / Math.max(1, to.per100.calories);
    score -= 60 * Math.abs(d1 - d2);
  }
  score += Math.min(6, to.per100.fiber) * 0.8;
  if (to.processing === "whole" || to.processing === "minimally_processed") score += 10;
  if (to.processing === "highly_processed" && !opts.allowProcessedIds?.has(to.id)) score -= 80;
  score += AVAILABILITY_SCORE[foodAvailability(to, opts.region ?? "global")];
  score -= (regionalCost(to, opts.region ?? "global") - 1) * (opts.preferCheap ? 8 : 2);
  if (opts.quick) score -= to.prep * 4;
  const pref = from.swaps?.indexOf(to.id) ?? -1;
  if (pref >= 0) score += 45 - pref * 5;
  if (from.role === "protein" && isLightSlot(opts.slot) && !BREAKFAST_PROTEINS.has(to.id)) score -= 45;
  if (from.role === "carb" && isLightSlot(opts.slot) && !BREAKFAST_CARBS.has(to.id)) score -= 45;
  if (opts.avoidIds?.has(to.id)) score -= 30;
  return score;
}

/** Ranked, constraint-safe substitutes for a catalog food. */
export function rankSubstitutes(from: FoodItem, opts: SwapOptions = {}): { food: FoodItem; score: number }[] {
  return FOOD_CATALOG.filter(
    (f) =>
      f.id !== from.id &&
      f.group !== "seasoning" &&
      !opts.excludeIds?.has(f.id) &&
      isFoodAllowed(f, opts.constraints)
  )
    .map((f) => ({ food: f, score: scoreSubstitute(from, f, opts) }))
    .filter((x) => Number.isFinite(x.score))
    .sort((a, b) => b.score - a.score);
}

export function findSubstitute(from: FoodItem, opts: SwapOptions = {}): FoodItem | null {
  return rankSubstitutes(from, opts)[0]?.food ?? null;
}

/** Grams of `to` that deliver the same primary nutrient as `fromGrams` of `from`. */
export function equivalentGrams(from: FoodItem, fromGrams: number, to: FoodItem): number {
  const key =
    from.role === "protein"
      ? "protein"
      : from.role === "carb" || from.role === "fruit"
        ? "carbs"
        : from.role === "fat"
          ? "fat"
          : from.role === "vegetable" || from.role === "beverage"
            ? null
            : "calories";
  let grams = fromGrams;
  if (key && to.per100[key] > 0 && from.per100[key] > 0) {
    grams = (fromGrams * from.per100[key]) / to.per100[key];
  } else if (to.per100.calories > 0 && from.per100.calories > 0 && key) {
    grams = (fromGrams * from.per100.calories) / to.per100.calories;
  }
  return Math.min(to.maxPerMeal, Math.max(to.serving * 0.35, grams));
}

// ─── Plan edits ─────────────────────────────────────────────────────────────

export type NutritionChange = {
  slot: AiNutritionMeal["slot"];
  from: string;
  to: string;
  fromAmount?: string;
  toAmount?: string;
};

export type NutritionEditResult = {
  plan: AiGeneratedNutritionPlan;
  changes: NutritionChange[];
  summary: string;
};

function ingredientMatches(ing: AiNutritionIngredient, query: string, queryFood: FoodItem | null): boolean {
  if (queryFood) {
    const a = analyzeIngredient(ing);
    if (a.food?.id === queryFood.id) return true;
  }
  const q = normalizeFoodText(query).replace(/(?:es|s)$/, "");
  return q.length >= 3 && normalizeFoodText(ing.name).includes(q);
}

function capitalizeLike(sample: string, text: string): string {
  return /^[A-Z]/.test(sample) ? text[0]!.toUpperCase() + text.slice(1) : text;
}

function renameInText(text: string, from: FoodItem | null, fromName: string, toName: string): string {
  if (!text) return text;
  const aliases = [...(from?.aliases ?? []), fromName.toLowerCase()].sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+")}(?:e?s)?\\b`, "i");
    const m = text.match(re);
    if (m) return text.replace(re, capitalizeLike(m[0], toName));
  }
  return text;
}

function totalsLine(plan: AiGeneratedNutritionPlan): string {
  const t = plan.daily_totals;
  if (!t) return "";
  const target = plan.daily_targets;
  return `Day now: ${plan.nutrition_estimated ? "~" : ""}${t.calories} kcal, P${t.protein} C${t.carbs} F${t.fat} (target ${target.calories} kcal, P${target.protein}).`;
}

/**
 * Swap a food everywhere it appears (or only in `slot`). With no `to`, the
 * engine picks the closest allowed whole-food substitute; portion is sized to
 * match the original's primary nutrient; totals are recalculated.
 */
export function swapFoodInPlan(
  plan: AiGeneratedNutritionPlan,
  args: { from: string; to?: string | null; slot?: AiNutritionMeal["slot"] | null },
  opts: SwapOptions = {}
): NutritionEditResult {
  const from = args.from.trim();
  if (!from) throw new NutritionEditError("Say which food to swap.");
  const fromFood = matchFood(from);
  const toText = args.to?.trim() || "";
  const requested = toText ? matchFood(toText) : null;
  if (toText && opts.constraints && !foodTextAllowed(toText, opts.constraints)) {
    throw new NutritionEditError(`"${toText}" breaks the client's food rules — pick a different replacement.`);
  }
  if (requested && !isFoodAllowed(requested, opts.constraints)) {
    throw new NutritionEditError(`"${requested.name}" breaks the client's food rules — pick a different replacement.`);
  }

  const changes: NutritionChange[] = [];
  const meals = plan.meals.map((meal) => {
    if (args.slot && meal.slot !== args.slot) return meal;
    let touched = false;
    let renamedFrom: { food: FoodItem | null; name: string; toName: string } | null = null;
    const ingredients = (meal.ingredients ?? []).map((ing) => {
      if (!ingredientMatches(ing, from, fromFood)) return ing;
      const a = analyzeIngredient(ing);
      const source = a.food ?? fromFood;
      const target =
        requested ??
        (source
          ? findSubstitute(source, {
              ...opts,
              slot: opts.slot ?? meal.slot,
              excludeIds: new Set([
                ...(opts.excludeIds ?? []),
                ...meal.ingredients!.map((i) => analyzeIngredient(i).food?.id).filter((x): x is string => Boolean(x)),
              ]),
            })
          : null);
      if (!target && !toText) {
        throw new NutritionEditError(`No suitable replacement for "${ing.name}" fits the client's food rules.`);
      }
      touched = true;
      if (!target) {
        const next = { name: toText, amount: ing.amount };
        changes.push({ slot: meal.slot, from: ing.name, to: toText, fromAmount: ing.amount, toAmount: ing.amount });
        renamedFrom = { food: a.food, name: ing.name, toName: toText };
        return next;
      }
      const grams = source ? equivalentGrams(source, a.grams, target) : gramsForAmount(target, parseAmount(ing.amount)).grams;
      const portion = formatPortion(target, grams, opts.lang);
      const name = toText && requested ? toText : foodDisplayName(target, opts.lang);
      changes.push({ slot: meal.slot, from: ing.name, to: name, fromAmount: ing.amount, toAmount: portion.amount });
      renamedFrom = { food: a.food, name: ing.name, toName: name };
      return { name, amount: portion.amount, food: target.id };
    });
    if (!touched) return meal;
    const r = renamedFrom as { food: FoodItem | null; name: string; toName: string } | null;
    return {
      ...meal,
      name: r ? renameInText(meal.name, r.food, r.name, r.toName) : meal.name,
      description: r && meal.description ? renameInText(meal.description, r.food, r.name, r.toName) : meal.description,
      ingredients,
    };
  });
  if (!changes.length) {
    throw new NutritionEditError(`"${from}" isn't in the current plan${args.slot ? ` (${args.slot})` : ""}.`);
  }
  const next = recalculateNutritionPlan({ ...plan, meals });
  const list = changes.map((c) => `${c.fromAmount ?? ""} ${c.from} → ${c.toAmount ?? ""} ${c.to}`.replace(/\s+/g, " ").trim());
  return {
    plan: next,
    changes,
    summary: `Swapped ${list.join("; ")}. Totals recalculated. ${totalsLine(next)}`.trim(),
  };
}

const RELATIVE_RE = /^(?:double|twice|x\s*2|2x|half|halve|a bit more|more|bigger|less|smaller|a bit less|triple|x\s*3|3x)$/;

function relativeFactor(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!RELATIVE_RE.test(t)) return null;
  if (/double|twice|x\s*2|2x/.test(t)) return 2;
  if (/triple|x\s*3|3x/.test(t)) return 3;
  if (/half|halve/.test(t)) return 0.5;
  if (/a bit more/.test(t)) return 1.15;
  if (/more|bigger/.test(t)) return 1.25;
  if (/a bit less/.test(t)) return 0.85;
  return 0.75;
}

/** Change one food's portion ("200g", "3 eggs", "double", "half") and recalculate. */
export function changePortionInPlan(
  plan: AiGeneratedNutritionPlan,
  args: { food: string; amount: string; slot?: AiNutritionMeal["slot"] | null },
  opts: { lang?: FoodLang } = {}
): NutritionEditResult {
  const query = args.food.trim();
  if (!query || !args.amount.trim()) throw new NutritionEditError("Say which food and the new amount.");
  const queryFood = matchFood(query);
  const factor = relativeFactor(args.amount);
  const parsed = factor == null ? parseAmount(args.amount) : null;
  if (factor == null && !parsed) throw new NutritionEditError(`Couldn't read the amount "${args.amount}".`);

  const changes: NutritionChange[] = [];
  const meals = plan.meals.map((meal) => {
    if (args.slot && meal.slot !== args.slot) return meal;
    if (changes.length && !args.slot) return meal;
    let touched = false;
    const ingredients = (meal.ingredients ?? []).map((ing) => {
      if (touched || !ingredientMatches(ing, query, queryFood)) return ing;
      const a = analyzeIngredient(ing);
      touched = true;
      if (!a.food) {
        changes.push({ slot: meal.slot, from: ing.name, to: ing.name, fromAmount: ing.amount, toAmount: args.amount });
        return { ...ing, amount: args.amount };
      }
      const grams = factor != null ? a.grams * factor : gramsForAmount(a.food, parsed).grams;
      const portion = formatPortion(a.food, Math.min(grams, a.food.maxPerMeal * 1.5), opts.lang);
      const amount = a.raw ? `${portion.amount} ${rawMarker(opts.lang)}` : portion.amount;
      changes.push({ slot: meal.slot, from: ing.name, to: ing.name, fromAmount: ing.amount, toAmount: amount });
      return { ...ing, amount, food: a.food.id };
    });
    return touched ? { ...meal, ingredients } : meal;
  });
  if (!changes.length) throw new NutritionEditError(`"${query}" isn't in the current plan.`);
  const next = recalculateNutritionPlan({ ...plan, meals });
  const c = changes[0]!;
  return {
    plan: next,
    changes,
    summary: `${c.to}: ${c.fromAmount ?? "?"} → ${c.toAmount}. Totals recalculated. ${totalsLine(next)}`.trim(),
  };
}

/** Macro-matched rotation options for a food (for "more variety" / "what else can I eat"). */
export function rotationOptions(
  ing: AiNutritionIngredient,
  opts: SwapOptions & { count?: number } = {}
): { name: string; amount: string; food: string }[] {
  const a = analyzeIngredient(ing);
  if (!a.food) return [];
  return rankSubstitutes(a.food, opts)
    .filter((x) => x.food.role === a.food!.role && x.food.processing !== "highly_processed")
    .filter((x) => !(a.food!.role === "protein" && isLightSlot(opts.slot) && !BREAKFAST_PROTEINS.has(x.food.id)))
    .filter((x) => !(a.food!.role === "carb" && isLightSlot(opts.slot) && BREAKFAST_CARBS.has(a.food!.id) && !BREAKFAST_CARBS.has(x.food.id)))
    .slice(0, opts.count ?? 2)
    .map(({ food }) => {
      const portion = formatPortion(food, equivalentGrams(a.food!, a.grams, food), opts.lang);
      return { name: foodDisplayName(food, opts.lang), amount: portion.amount, food: food.id };
    });
}

export { getFood };
