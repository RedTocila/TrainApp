/**
 * Nutrition plan quality: whole-food defaults, simplicity, realistic portions,
 * fiber/vegetables, deterministic fixes, grocery list, rotation ideas and the
 * final validation report. Pure — no LLM, no I/O.
 */

import {
  foodDisplayName,
  getFood,
  HIGHLY_PROCESSED_TEXT_RE,
  isWholeFoodLevel,
  matchFoods,
  type FoodItem,
  type FoodLang,
} from "@/lib/ai/food-catalog";
import { isPracticalMenuFood, type FoodRegion } from "@/lib/ai/food-availability";
import { formatPortion } from "@/lib/ai/food-portions";
import {
  equivalentGrams,
  findSubstitute,
  isFoodAllowed,
  rotationOptions,
  type SwapOptions,
} from "@/lib/ai/food-swap";
import {
  analyzeIngredient,
  analyzeMeal,
  MEAL_HEAVY_FACTOR,
  mealCalorieShares,
  rawMarker,
  type MacroTargets,
} from "@/lib/ai/nutrition-calc";
import { maxIngredientsFor, type MealSlotId, type NutritionStyle } from "@/lib/ai/nutrition-context";
import {
  findFoodViolations,
  foodTextAllowed,
  hasNutritionConstraints,
  type NutritionConstraints,
} from "@/lib/ai/nutrition-constraints";
import type {
  AiGeneratedNutritionPlan,
  AiNutritionIngredient,
  AiNutritionMeal,
} from "@/lib/ai/plan-builder-types";

export type QualityContext = {
  constraints: NutritionConstraints;
  style: NutritionStyle;
  slots: MealSlotId[];
  targets: MacroTargets;
  requestedFoodIds: ReadonlySet<string>;
  allowedProcessedIds: ReadonlySet<string>;
  lang?: FoodLang;
  region?: FoodRegion;
};

const SLOT_ORDER: MealSlotId[] = ["breakfast", "snack_1", "lunch", "snack_2", "dinner"];

function swapOpts(ctx: QualityContext, excludeIds: string[] = []): SwapOptions {
  return {
    constraints: ctx.constraints,
    preferCheap: ctx.style.budget,
    quick: ctx.style.quick,
    allowProcessedIds: ctx.allowedProcessedIds,
    excludeIds: new Set(excludeIds),
    lang: ctx.lang,
    region: ctx.region,
  };
}

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function isSeasoning(food: FoodItem | null): boolean {
  return food?.group === "seasoning";
}

function processedNotRequested(food: FoodItem, ctx: QualityContext): boolean {
  if (ctx.requestedFoodIds.has(food.id) || ctx.allowedProcessedIds.has(food.id)) return false;
  if (food.processing === "highly_processed") return true;
  return food.id === "orange_juice";
}

// ─── Deterministic ingredient replacement ──────────────────────────────────

export type ReplaceReason = "constraint" | "processed";

export type Replacement = { slot: MealSlotId; from: string; to: string | null; reason: ReplaceReason };

/**
 * Replace ingredients that break food rules or are unrequested highly processed
 * foods with a nutritionally similar allowed whole food (portion re-sized).
 */
export function replaceProblemIngredients(
  plan: AiGeneratedNutritionPlan,
  ctx: QualityContext
): { plan: AiGeneratedNutritionPlan; fixes: string[]; replaced: Replacement[] } {
  const fixes: string[] = [];
  const replaced: Replacement[] = [];
  const dayFoods = new Set(
    plan.meals.flatMap((m) => (m.ingredients ?? []).map((i) => analyzeIngredient(i).food?.id).filter((x): x is string => Boolean(x)))
  );
  const meals = plan.meals.map((meal) => {
    const used = (meal.ingredients ?? []).map((i) => analyzeIngredient(i).food?.id).filter((x): x is string => Boolean(x));
    let nameText = meal.name;
    let descText = meal.description ?? "";
    const ingredients: AiNutritionIngredient[] = [];
    const flagged = (meal.ingredients ?? []).map((ing) => {
      const a = analyzeIngredient(ing);
      const breaksRule =
        hasNutritionConstraints(ctx.constraints) &&
        (!foodTextAllowed(ing.name, ctx.constraints) || (a.food ? !isFoodAllowed(a.food, ctx.constraints) : false));
      const processed = a.food ? processedNotRequested(a.food, ctx) : HIGHLY_PROCESSED_TEXT_RE.test(ing.name);
      return { ing, a, breaksRule, processed };
    });
    const keptRoles = new Set(
      flagged.filter((x) => !x.breaksRule && !x.processed && x.a.food).map((x) => x.a.food!.role)
    );
    for (const { ing, a, breaksRule, processed } of flagged) {
      if (!breaksRule && !processed) {
        ingredients.push(ing);
        continue;
      }
      const reason: ReplaceReason = breaksRule ? "constraint" : "processed";
      const role = a.food?.role;
      if (role && (role === "protein" || role === "fat" || role === "carb") && keptRoles.has(role)) {
        replaced.push({ slot: meal.slot, from: ing.name, to: null, reason });
        fixes.push(`removed ${ing.name} (meal already has another ${role} source)`);
        continue;
      }
      const sub = a.food ? findSubstitute(a.food, { ...swapOpts(ctx, used), slot: meal.slot, avoidIds: dayFoods }) : null;
      const subName = sub ? foodDisplayName(sub, ctx.lang) : "";
      if (!sub || sub.per100.calories === 0) {
        replaced.push({ slot: meal.slot, from: ing.name, to: sub ? subName : null, reason });
        fixes.push(sub ? `${ing.name} → ${subName}` : `removed ${ing.name}${reason === "processed" ? " (highly processed)" : ""}`);
        continue;
      }
      used.push(sub.id);
      dayFoods.add(sub.id);
      replaced.push({ slot: meal.slot, from: ing.name, to: subName, reason });
      const portion = formatPortion(sub, equivalentGrams(a.food!, a.grams, sub), ctx.lang);
      ingredients.push({ name: subName, amount: portion.amount, food: sub.id });
      fixes.push(`${ing.name} → ${subName}${reason === "processed" ? " (whole-food swap)" : ""}`);
      for (const alias of [...a.food!.aliases].sort((x, y) => y.length - x.length)) {
        const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+")}(?:e?s)?\\b`, "i");
        if (re.test(nameText) || re.test(descText)) {
          nameText = nameText.replace(re, (m) => (/^[A-Z]/.test(m) ? cap(subName) : subName));
          descText = descText.replace(re, subName);
          break;
        }
      }
    }
    return { ...meal, name: nameText, description: descText, ingredients };
  });
  return { plan: { ...plan, meals }, fixes, replaced };
}

const UNSAFE_RAW_RE =
  /\b(?:raw|uncooked|undercooked|rare)\s+(?:eggs?|egg (?:yolks?|whites?)|chicken|turkey|poultry|beef|pork|meat|mince|fish|salmon|tuna|shrimp|prawns?)\b|\b(?:steak |beef |salmon |tuna )?tartare\b|\bcarpaccio\b|\beggnog\b/i;

const UNSAFE_RAW_SQ_RE =
  /\b(?:mish\w*|vez[eë]\w*|peshk\w*|pul[eë]\w*|salmon\w*|ton\w*|karkalec\w*)\s+(?:i|e|t[eë])\s+(?:gjall[eë]\w*|gjalla|papjekur\w*|pagatuar\w*|pa gatuar)(?=$|[^\p{L}])/iu;

function hasUnsafeRaw(text: string): boolean {
  return UNSAFE_RAW_RE.test(text) || UNSAFE_RAW_SQ_RE.test(text);
}

export function isUnsafeRawFood(text: string): boolean {
  return hasUnsafeRaw(text);
}

/** Animal foods are always served cooked (no raw eggs/meat/fish, tartare, carpaccio). */
export function makeFoodSafe(plan: AiGeneratedNutritionPlan): { plan: AiGeneratedNutritionPlan; fixes: string[] } {
  const fixes: string[] = [];
  const clean = (text: string) =>
    text
      .replace(/\b(?:raw|uncooked|undercooked|rare)\s+(?=(?:eggs?|egg |chicken|turkey|poultry|beef|pork|meat|mince|fish|salmon|tuna|shrimp|prawns?)\b)/gi, "cooked ")
      .replace(/\b(?:salmon|tuna) tartare\b/gi, "baked salmon")
      .replace(/\b(?:steak |beef )?tartare\b|\bcarpaccio\b/gi, "grilled lean beef")
      .replace(/\beggnog\b/gi, "milk")
      .replace(
        /(\s(?:i|e|t[eë])\s+)(?:gjall[eë]\w*|gjalla|papjekur\w*|pagatuar\w*|pa gatuar)(?=$|[^\p{L}])/giu,
        "$1gatuar"
      );
  const meals = plan.meals.map((meal) => {
    let touched = false;
    const ingredients = meal.ingredients?.map((ing) => {
      if (!hasUnsafeRaw(ing.name)) return ing;
      touched = true;
      const name = clean(ing.name);
      fixes.push(`${ing.name} → ${name} (always cooked)`);
      return { ...ing, name };
    });
    const name = hasUnsafeRaw(meal.name) ? clean(meal.name) : meal.name;
    const description = meal.description && hasUnsafeRaw(meal.description) ? clean(meal.description) : meal.description;
    return touched || name !== meal.name || description !== meal.description ? { ...meal, name, description, ingredients } : meal;
  });
  return { plan: { ...plan, meals }, fixes };
}

/** Certified gluten-free oats when gluten is excluded (oats are often cross-contaminated). */
const GLUTEN_FREE_TEXT_RE = /gluten[\s-]free|pa gluten/i;

export function markGlutenFreeOats(
  plan: AiGeneratedNutritionPlan,
  c: NutritionConstraints,
  lang: FoodLang = "en"
): AiGeneratedNutritionPlan {
  if (!c.categories.includes("gluten")) return plan;
  const label = lang === "al" ? "tërshërë pa gluten (e certifikuar)" : "certified gluten-free oats";
  return {
    ...plan,
    meals: plan.meals.map((m) => ({
      ...m,
      ingredients: m.ingredients?.map((i) =>
        analyzeIngredient(i).food?.id === "oats" && !GLUTEN_FREE_TEXT_RE.test(i.name)
          ? { ...i, name: label, food: "oats" }
          : i
      ),
    })),
  };
}

// ─── Simplicity ─────────────────────────────────────────────────────────────

const STEP_WORDS_RE = /\b(?:then|step \d|marinate|whisk|preheat|simmer for|blend until|fold in|reduce the sauce|deglaze|knead|overnight|let it rest|garnish)\b/i;
const ROLE_PRIORITY: Record<string, number> = { protein: 0, carb: 1, vegetable: 2, fruit: 2, fat: 3, mixed: 4, treat: 5, beverage: 6, condiment: 7 };
const GENERIC_NAME_RE = /^(?:breakfast|lunch|dinner|morning snack|afternoon snack|snack|meal \d)(?: bowl| plate)?$/i;

/** Keep meals to a handful of foods; merge extra vegetables; short names/descriptions. */
export function simplifyMeals(
  plan: AiGeneratedNutritionPlan,
  ctx: QualityContext
): { plan: AiGeneratedNutritionPlan; fixes: string[] } {
  const max = maxIngredientsFor(ctx.style);
  const fixes: string[] = [];
  const recipes = ctx.style.complexity === "recipes";
  const mixedVegAllowed = isFoodAllowed(getFood("mixed_vegetables")!, ctx.constraints);

  const meals = plan.meals.map((meal) => {
    let items = (meal.ingredients ?? []).map((ing) => ({ ing, a: analyzeIngredient(ing) }));
    const real = () => items.filter((x) => !isSeasoning(x.a.food));

    const vegs = items.filter((x) => x.a.food?.role === "vegetable");
    if (real().length > max && vegs.length > 1 && mixedVegAllowed) {
      const grams = vegs.reduce((acc, x) => acc + x.a.grams, 0);
      const food = getFood("mixed_vegetables")!;
      const merged = {
        name: `${foodDisplayName(food, ctx.lang)} (${vegs.map((v) => foodDisplayName(v.a.food!, ctx.lang)).slice(0, 3).join(", ")})`,
        amount: formatPortion(food, Math.min(grams, food.maxPerMeal), ctx.lang).amount,
        food: food.id,
      };
      const firstIdx = items.indexOf(vegs[0]!);
      items = items.filter((x) => !vegs.includes(x));
      items.splice(firstIdx, 0, { ing: merged, a: analyzeIngredient(merged) });
      fixes.push(`${meal.slot}: merged ${vegs.length} vegetables into one`);
    }
    if (real().length > max) {
      const ranked = [...real()].sort((x, y) => {
        const rx = ROLE_PRIORITY[x.a.food?.role ?? "mixed"] ?? 4;
        const ry = ROLE_PRIORITY[y.a.food?.role ?? "mixed"] ?? 4;
        return rx - ry || y.a.nutrients.calories - x.a.nutrients.calories;
      });
      const seenRoles = new Set<string>();
      const keep: typeof ranked = [];
      for (const x of ranked) {
        const role = x.a.food?.role ?? "mixed";
        if (!seenRoles.has(role) && keep.length < max) {
          keep.push(x);
          seenRoles.add(role);
        }
      }
      for (const x of ranked) if (!keep.includes(x) && keep.length < max) keep.push(x);
      const dropped = real().filter((x) => !keep.includes(x));
      items = items.filter((x) => isSeasoning(x.a.food) || keep.includes(x));
      if (dropped.length) fixes.push(`${meal.slot}: dropped ${dropped.map((d) => d.ing.name).join(", ")} to keep it simple`);
    }

    let name = meal.name;
    const presentFoods = items.map((x) => x.a.food).filter((f): f is FoodItem => Boolean(f));
    const stale =
      !name.trim() ||
      GENERIC_NAME_RE.test(name.trim()) ||
      matchFoods(name).some(
        (m) =>
          m.food.group !== "seasoning" &&
          !presentFoods.some((f) => f.id === m.food.id || (f.group === m.food.group && f.role === m.food.role))
      );
    if (stale || (!recipes && (name.length > 48 || (name.match(/,/g) ?? []).length >= 3))) {
      const main = real()
        .slice()
        .sort((x, y) => (ROLE_PRIORITY[x.a.food?.role ?? "mixed"] ?? 4) - (ROLE_PRIORITY[y.a.food?.role ?? "mixed"] ?? 4))
        .slice(0, 3)
        .map((x) => (x.a.food ? foodDisplayName(x.a.food, ctx.lang) : x.ing.name).replace(/\s*\(.*\)$/, ""));
      name =
        main.length >= 2
          ? cap(`${main.slice(0, -1).join(", ")} & ${main.at(-1)}`)
          : main.length === 1
            ? cap(main[0]!)
            : name.slice(0, 48);
    }
    let description = meal.description ?? "";
    if (!recipes && (description.length > 140 || STEP_WORDS_RE.test(description))) {
      const first = description.split(/(?<=[.!?])\s/)[0] ?? "";
      description = first.length <= 120 && !STEP_WORDS_RE.test(first) ? first : "";
    }
    return { ...meal, name, description, ingredients: items.map((x) => x.ing) };
  });
  return { plan: { ...plan, meals }, fixes };
}

/** Lunch/dinner without any vegetable or fruit get a simple vegetable side. */
export function ensureVegetables(
  plan: AiGeneratedNutritionPlan,
  ctx: QualityContext
): { plan: AiGeneratedNutritionPlan; fixes: string[] } {
  const fixes: string[] = [];
  const used = new Set<string>();
  const options = ["mixed_vegetables", "salad", "broccoli", "green_beans", "carrot", "tomato", "cucumber"]
    .map((id) => getFood(id)!)
    .filter((f) => isFoodAllowed(f, ctx.constraints));
  if (!options.length) return { plan, fixes };
  const max = maxIngredientsFor(ctx.style);
  const meals = plan.meals.map((meal) => {
    if (meal.slot !== "lunch" && meal.slot !== "dinner") return meal;
    const items = (meal.ingredients ?? []).map((i) => analyzeIngredient(i));
    const hasPlant = items.some((a) => a.food?.role === "vegetable" || a.food?.role === "fruit" || /\b(?:salad|vegetables?|veg|greens)\b/i.test(a.ingredient.name));
    if (hasPlant || !items.length) return meal;
    const pick = options.find((f) => !used.has(f.id)) ?? options[0]!;
    used.add(pick.id);
    const real = items.filter((a) => !isSeasoning(a.food)).length;
    let ingredients = [...(meal.ingredients ?? [])];
    if (real >= max) {
      const dropIdx = items.findIndex((a) => a.food?.role === "condiment" || a.food?.role === "treat" || !a.food);
      if (dropIdx >= 0) ingredients = ingredients.filter((_, i) => i !== dropIdx);
    }
    ingredients.push({ name: foodDisplayName(pick, ctx.lang), amount: formatPortion(pick, pick.serving, ctx.lang).amount, food: pick.id });
    fixes.push(`${meal.slot}: added ${pick.name} for fiber and micronutrients`);
    return { ...meal, ingredients };
  });
  return { plan: { ...plan, meals }, fixes };
}

/** Lunch/dinner without any starch or legume get a simple carb side (template: protein + carb + vegetable). */
export function ensureCarbSources(
  plan: AiGeneratedNutritionPlan,
  ctx: QualityContext
): { plan: AiGeneratedNutritionPlan; fixes: string[] } {
  const fixes: string[] = [];
  if (ctx.style.lowCarb) return { plan, fixes };
  const practical = {
    region: ctx.region ?? "global",
    allowLimited: false,
    budget: ctx.style.budget,
    requested: ctx.requestedFoodIds,
  };
  const options = ["white_rice", "potatoes", "wholegrain_bread", "pasta", "brown_rice", "bulgur"]
    .map((id) => getFood(id))
    .filter((f): f is FoodItem => Boolean(f) && isFoodAllowed(f!, ctx.constraints) && isPracticalMenuFood(f!, practical));
  if (!options.length) return { plan, fixes };
  const max = maxIngredientsFor(ctx.style);
  const used = new Set<string>();
  const meals = plan.meals.map((meal) => {
    if (meal.slot !== "lunch" && meal.slot !== "dinner") return meal;
    const items = (meal.ingredients ?? []).map((i) => analyzeIngredient(i));
    if (!items.length || items.some((a) => a.food?.role === "carb" || a.food?.group === "legume" || (!a.food && a.nutrients.carbs > 20))) {
      items.forEach((a) => a.food && used.add(a.food.id));
      return meal;
    }
    if (items.filter((a) => !isSeasoning(a.food)).length >= max) return meal;
    const pick = options.find((f) => !used.has(f.id)) ?? options[0]!;
    used.add(pick.id);
    fixes.push(`${meal.slot}: added ${pick.name} as the carb source`);
    return {
      ...meal,
      ingredients: [
        ...(meal.ingredients ?? []),
        { name: foodDisplayName(pick, ctx.lang), amount: formatPortion(pick, pick.serving, ctx.lang).amount, food: pick.id },
      ],
    };
  });
  return { plan: { ...plan, meals }, fixes };
}

/**
 * When the day is far below the fat target and lunch/dinner have no fat source,
 * add a drizzle of olive oil (or another allowed fat) so portion fitting can
 * reach the target without piling on starch.
 */
export function ensureFatSource(
  plan: AiGeneratedNutritionPlan,
  ctx: QualityContext
): { plan: AiGeneratedNutritionPlan; fixes: string[] } {
  const fixes: string[] = [];
  if (ctx.targets.fat <= 0) return { plan, fixes };
  const dayFat = plan.meals.reduce((acc, m) => acc + analyzeMeal(m).total.fat, 0);
  if (dayFat >= ctx.targets.fat * 0.75) return { plan, fixes };
  const pick = ["olive_oil", "avocado", "almonds", "walnuts", "pumpkin_seeds"]
    .map((id) => getFood(id))
    .find(
      (f): f is FoodItem =>
        Boolean(f) &&
        isFoodAllowed(f!, ctx.constraints) &&
        isPracticalMenuFood(f!, { region: ctx.region ?? "global", allowLimited: false, budget: ctx.style.budget })
    );
  if (!pick) return { plan, fixes };
  const max = maxIngredientsFor(ctx.style);
  const meals = plan.meals.map((meal) => {
    if (meal.slot !== "lunch" && meal.slot !== "dinner") return meal;
    const items = (meal.ingredients ?? []).map((i) => analyzeIngredient(i));
    if (!items.length || items.some((a) => a.food?.role === "fat")) return meal;
    if (items.filter((a) => !isSeasoning(a.food)).length >= max) return meal;
    fixes.push(`${meal.slot}: added ${pick.name} (day was low on fat)`);
    return {
      ...meal,
      ingredients: [
        ...(meal.ingredients ?? []),
        { name: foodDisplayName(pick, ctx.lang), amount: formatPortion(pick, pick.serving, ctx.lang).amount, food: pick.id },
      ],
    };
  });
  return { plan: { ...plan, meals }, fixes };
}

/** Round every catalog ingredient to a clean, realistic portion. */
export function normalizePortions(
  plan: AiGeneratedNutritionPlan,
  lang: FoodLang = "en"
): { plan: AiGeneratedNutritionPlan; fixes: string[] } {
  const fixes: string[] = [];
  const meals = plan.meals.map((meal) => ({
    ...meal,
    ingredients: meal.ingredients?.map((ing) => {
      const a = analyzeIngredient(ing);
      if (!a.food) return ing;
      let grams = a.grams;
      if (grams > a.food.maxPerMeal) {
        fixes.push(`${ing.name}: capped at a realistic portion`);
        grams = a.food.maxPerMeal;
      }
      const portion = formatPortion(a.food, grams, lang);
      return { ...ing, amount: a.raw ? `${portion.amount} ${rawMarker(lang)}` : portion.amount, food: a.food.id };
    }),
  }));
  return { plan: { ...plan, meals }, fixes };
}

// ─── Templates (missing slots / generation failure) ────────────────────────

const TEMPLATE_CHOICES: Record<MealSlotId, string[][]> = {
  breakfast: [["eggs", "greek_yogurt", "cottage_cheese", "tofu", "soy_yogurt"], ["oats", "wholegrain_bread", "potatoes"], ["banana", "berries", "apple"]],
  snack_1: [["greek_yogurt", "cottage_cheese", "eggs", "soy_yogurt", "hummus"], ["apple", "berries", "banana", "carrot"]],
  lunch: [["chicken_breast", "turkey_breast", "lean_beef", "tofu", "lentils", "chickpeas"], ["white_rice", "potatoes", "quinoa"], ["mixed_vegetables", "broccoli", "salad"], ["olive_oil"]],
  snack_2: [["greek_yogurt", "cottage_cheese", "eggs", "soy_yogurt", "hummus"], ["berries", "apple", "banana", "carrot"], ["almonds", "pumpkin_seeds", "walnuts"]],
  dinner: [["salmon", "lean_beef", "turkey_breast", "white_fish", "chicken_thigh", "tofu", "lentils", "black_beans"], ["potatoes", "sweet_potato", "brown_rice"], ["salad", "broccoli", "green_beans"], ["olive_oil", "avocado"]],
};

export function templateMeal(slot: MealSlotId, ctx: QualityContext, avoidIds: ReadonlySet<string> = new Set()): AiNutritionMeal | null {
  const ingredients: AiNutritionIngredient[] = [];
  for (const group of TEMPLATE_CHOICES[slot]) {
    const foods = group.map((id) => getFood(id)!).filter((f) => isFoodAllowed(f, ctx.constraints));
    const pick = foods.find((f) => !avoidIds.has(f.id)) ?? foods[0];
    if (!pick) continue;
    ingredients.push({ name: foodDisplayName(pick, ctx.lang), amount: formatPortion(pick, pick.serving, ctx.lang).amount, food: pick.id });
  }
  if (ingredients.length < 2) return null;
  const names = ingredients.filter((i) => getFood(i.food!)?.role !== "fat").map((i) => i.name);
  return {
    slot,
    name: cap(names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names.at(-1)}` : names[0]!),
    description: "",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ingredients,
  };
}

/** Keep only the chosen slots (one meal each) and fill any missing slot from templates. */
export function enforceMealSlots(
  plan: AiGeneratedNutritionPlan,
  ctx: QualityContext
): { plan: AiGeneratedNutritionPlan; fixes: string[] } {
  const fixes: string[] = [];
  const bySlot = new Map<MealSlotId, AiNutritionMeal>();
  for (const meal of plan.meals) {
    if (!ctx.slots.includes(meal.slot)) {
      fixes.push(`removed ${meal.slot} (not part of the chosen meal structure)`);
      continue;
    }
    if (!bySlot.has(meal.slot)) bySlot.set(meal.slot, meal);
  }
  const usedProteins = new Set(
    [...bySlot.values()].flatMap((m) => (m.ingredients ?? []).map((i) => analyzeIngredient(i).food).filter((f) => f?.role === "protein").map((f) => f!.id))
  );
  for (const slot of ctx.slots) {
    if (bySlot.has(slot) && (bySlot.get(slot)!.ingredients?.length ?? 0) > 0) continue;
    const t = templateMeal(slot, ctx, usedProteins);
    if (!t) continue;
    t.ingredients?.forEach((i) => usedProteins.add(i.food!));
    bySlot.set(slot, t);
    fixes.push(`filled ${slot} with a simple whole-food meal`);
  }
  const meals = SLOT_ORDER.filter((s) => bySlot.has(s)).map((s) => bySlot.get(s)!);
  return { plan: { ...plan, meals }, fixes };
}

// ─── Grocery list & rotation ───────────────────────────────────────────────

function groceryCategory(food: FoodItem): string {
  switch (food.group) {
    case "poultry":
    case "red_meat":
    case "pork":
    case "fish":
    case "seafood":
    case "eggs":
    case "plant_protein":
      return "Protein";
    case "dairy":
      return "Dairy";
    case "vegetable":
    case "fruit":
    case "starchy_veg":
      return "Produce";
    default:
      return "Pantry";
  }
}

function weeklyAmount(food: FoodItem, grams: number, lang: FoodLang): string {
  if (food.display === "piece" && food.units.piece) {
    const count = Math.ceil(grams / food.units.piece - 0.01);
    return `${count}`;
  }
  if (food.display === "ml") {
    const ml = grams / (food.density ?? 1);
    return ml >= 1000 ? `${(Math.ceil(ml / 250) * 0.25).toFixed(2).replace(/\.?0+$/, "")} L` : `${Math.ceil(ml / 50) * 50} ml`;
  }
  if (food.display === "slice" && food.units.slice) {
    return `${Math.ceil(grams / food.units.slice)} ${lang === "al" ? "feta" : "slices"}`;
  }
  if (grams >= 1000) return `${(Math.ceil(grams / 100) / 10).toFixed(1)} kg`;
  return `${Math.ceil(grams / 50) * 50} g`;
}

export type MenuOccurrence = { plan: AiGeneratedNutritionPlan; days: number };

/**
 * Grocery list for a week where each menu is eaten `days` times (one menu
 * repeated, or rotating Day A/B/C menus). Built from the final meals.
 */
export function buildGroceryListForMenus(
  menus: readonly MenuOccurrence[],
  lang: FoodLang = "en"
): NonNullable<AiGeneratedNutritionPlan["grocery_list"]> {
  const byFood = new Map<string, { food: FoodItem; grams: number; label: string }>();
  const other = new Map<string, { amount: string; days: number }>();
  for (const { plan, days } of menus) {
    if (days <= 0) continue;
    for (const meal of plan.meals) {
      for (const ing of meal.ingredients ?? []) {
        const a = analyzeIngredient(ing);
        if (a.food) {
          if (a.food.group === "seasoning" || a.food.id === "water") continue;
          const prev = byFood.get(a.food.id);
          byFood.set(a.food.id, {
            food: a.food,
            grams: (prev?.grams ?? 0) + a.grams * days,
            label:
              prev?.label ??
              (a.food.id === "oats" && GLUTEN_FREE_TEXT_RE.test(ing.name) ? ing.name : foodDisplayName(a.food, lang)),
          });
        } else {
          const key = ing.name.trim();
          const prev = other.get(key);
          other.set(key, { amount: prev?.amount || ing.amount || "", days: (prev?.days ?? 0) + days });
        }
      }
    }
  }
  const list = [...byFood.values()].map(({ food, grams, label }) => ({
    name: cap(label),
    amount: weeklyAmount(food, grams, lang),
    category: groceryCategory(food),
  }));
  for (const [name, { amount, days }] of other) {
    list.push({
      name: cap(name),
      amount: amount ? `${amount} × ${days}` : lang === "al" ? `për ${days} ditë` : `for ${days} days`,
      category: "Other",
    });
  }
  const order = ["Protein", "Dairy", "Produce", "Pantry", "Other"];
  return list.sort((x, y) => order.indexOf(x.category) - order.indexOf(y.category) || x.name.localeCompare(y.name));
}

/** Weekly grocery list for one menu eaten every day. */
export function buildGroceryList(
  plan: AiGeneratedNutritionPlan,
  days = 7,
  lang: FoodLang = "en"
): NonNullable<AiGeneratedNutritionPlan["grocery_list"]> {
  return buildGroceryListForMenus([{ plan, days }], lang);
}

const ROTATION_LABELS: Record<FoodLang, Partial<Record<MealSlotId, string>>> = {
  en: { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" },
  al: { breakfast: "Mëngjes", lunch: "Drekë", dinner: "Darkë" },
};

/** One short line of macro-matched swaps per main meal so the week isn't identical. */
export function rotationNotes(plan: AiGeneratedNutritionPlan, ctx: QualityContext): string[] {
  if (ctx.style.complexity === "very_simple") return [];
  const lang = ctx.lang ?? "en";
  const count = ctx.style.complexity === "variety" ? 3 : 2;
  const lines: string[] = [];
  for (const meal of plan.meals) {
    const label = ROTATION_LABELS[lang][meal.slot];
    if (!label) continue;
    const protein = (meal.ingredients ?? []).find((i) => analyzeIngredient(i).food?.role === "protein");
    if (!protein) continue;
    const opts = rotationOptions(protein, { ...swapOpts(ctx), slot: meal.slot, count });
    if (!opts.length) continue;
    lines.push(`${label}: ${protein.amount ?? ""} ${protein.name} ↔ ${opts.map((o) => `${o.amount} ${o.name}`).join(" ↔ ")}`.replace(/\s+/g, " "));
    if (lines.length >= (ctx.style.complexity === "variety" ? 3 : 2)) break;
  }
  if (!lines.length) return [];
  return lang === "al"
    ? [`Ndërroji proteinat gjatë javës (porcionet janë rillogaritur): ${lines.join(" · ")}.`]
    : [`Rotate proteins through the week (same protein, recalculated portions): ${lines.join(" · ")}.`];
}

const SLOT_LABELS: Record<MealSlotId, string> = {
  breakfast: "Breakfast",
  snack_1: "Snack",
  lunch: "Lunch",
  snack_2: "Snack",
  dinner: "Dinner",
};

function formatMenuLines(
  meals: readonly AiNutritionMeal[],
  totals: AiGeneratedNutritionPlan["daily_totals"],
  estimated: boolean | undefined,
  targets: AiGeneratedNutritionPlan["daily_targets"]
): string[] {
  const lines: string[] = [];
  meals.forEach((meal, i) => {
    const mealEst = meal.macro_source === "estimated" ? "~" : "";
    lines.push(`MEAL ${i + 1} — ${SLOT_LABELS[meal.slot]}: ${meal.name} (${mealEst}${meal.calories} kcal, P${meal.protein} C${meal.carbs} F${meal.fat})`);
    for (const ing of meal.ingredients ?? []) {
      const amount = (ing.amount ?? "").trim();
      lines.push(/^(?:to taste|sipas shijes)$/.test(amount) ? `  ${ing.name}, ${amount}` : `  ${amount ? `${amount} ` : ""}${ing.name}`);
    }
  });
  if (totals) {
    lines.push(
      `DAY TOTAL: ${estimated ? "~" : ""}${totals.calories} kcal · P${totals.protein} C${totals.carbs} F${totals.fat} · fiber ${totals.fiber} g (target ${targets.calories} kcal, P${targets.protein} C${targets.carbs} F${targets.fat})`
    );
  }
  return lines;
}

/** Plain, scannable plan text ("MEAL 1 — Breakfast / 3 large eggs / 60g oats …"); one block per daily menu. */
export function formatNutritionPlanText(plan: AiGeneratedNutritionPlan): string {
  const main = formatMenuLines(plan.meals, plan.daily_totals, plan.nutrition_estimated, plan.daily_targets);
  if (!plan.day_variants?.length) return main.join("\n");
  const blocks = [
    [`=== ${plan.day_label ?? "Day A"} ===`, ...main],
    ...plan.day_variants.map((v) => [
      `=== ${v.label} ===`,
      ...formatMenuLines(v.meals, v.daily_totals, v.nutrition_estimated, plan.daily_targets),
    ]),
  ];
  return [
    `${blocks.length} daily menus rotate through the week (A, B, C, A…). Edits apply to every menu that has the food.`,
    ...blocks.map((b) => b.join("\n")),
  ].join("\n\n");
}

// ─── Validation ─────────────────────────────────────────────────────────────

export type NutritionIssue = {
  code:
    | "food_rule"
    | "highly_processed"
    | "calories_off"
    | "protein_low"
    | "meal_structure"
    | "empty_meal"
    | "totals_mismatch"
    | "too_complex"
    | "low_fiber"
    | "low_whole_food_share"
    | "portion_unrealistic"
    | "many_estimates"
    | "no_vegetables"
    | "unsafe_raw"
    | "meal_unbalanced";
  severity: "hard" | "major" | "minor";
  message: string;
};

export function validateNutritionPlan(plan: AiGeneratedNutritionPlan, ctx: QualityContext): NutritionIssue[] {
  const issues: NutritionIssue[] = [];
  for (const v of findFoodViolations(plan, ctx.constraints).slice(0, 8)) {
    issues.push({ code: "food_rule", severity: "hard", message: `${v.where}${v.slot ? ` (${v.slot})` : ""}: "${v.item}" contains ${v.reason}` });
  }

  let wholeKcal = 0;
  let totalKcal = 0;
  let estimatedKcal = 0;
  let vegCount = 0;
  const max = maxIngredientsFor(ctx.style);
  for (const meal of plan.meals) {
    const a = analyzeMeal(meal);
    if (!meal.ingredients?.length) {
      issues.push({ code: "empty_meal", severity: "major", message: `${meal.slot} has no foods listed` });
    }
    for (const text of [meal.name, meal.description ?? "", ...(meal.ingredients ?? []).map((i) => i.name)]) {
      if (hasUnsafeRaw(text)) {
        issues.push({ code: "unsafe_raw", severity: "hard", message: `${meal.slot}: "${text}" — animal foods must be cooked` });
      }
    }
    const real = a.items.filter((i) => !isSeasoning(i.food)).length;
    if (real > max + 1) issues.push({ code: "too_complex", severity: "minor", message: `${meal.slot} has ${real} foods (keep ≤ ${max})` });
    for (const item of a.items) {
      totalKcal += item.nutrients.calories;
      if (!item.food) {
        estimatedKcal += item.nutrients.calories;
        if (HIGHLY_PROCESSED_TEXT_RE.test(item.ingredient.name)) {
          issues.push({ code: "highly_processed", severity: "hard", message: `${meal.slot}: "${item.ingredient.name}" is a highly processed food the client didn't ask for` });
        }
        continue;
      }
      if (isWholeFoodLevel(item.food.processing)) wholeKcal += item.nutrients.calories;
      if (item.food.role === "vegetable") vegCount++;
      if (processedNotRequested(item.food, ctx) && item.food.processing === "highly_processed") {
        issues.push({ code: "highly_processed", severity: "hard", message: `${meal.slot}: "${item.ingredient.name}" is highly processed and wasn't requested` });
      }
      if (item.grams > item.food.maxPerMeal * 1.05) {
        issues.push({ code: "portion_unrealistic", severity: "major", message: `${meal.slot}: ${item.ingredient.amount} ${item.ingredient.name} is more than a realistic portion` });
      }
    }
  }

  const slotsInPlan = plan.meals.map((m) => m.slot);
  if (slotsInPlan.length !== ctx.slots.length || ctx.slots.some((s) => !slotsInPlan.includes(s))) {
    issues.push({ code: "meal_structure", severity: "major", message: `meals should be exactly: ${ctx.slots.join(", ")}` });
  }

  const totals = plan.daily_totals;
  if (totals) {
    const sum = plan.meals.reduce((acc, m) => acc + m.calories, 0);
    if (sum !== totals.calories) issues.push({ code: "totals_mismatch", severity: "major", message: "meal calories don't add up to the daily total" });
    const t = ctx.targets;
    if (t.calories > 0 && Math.abs(totals.calories - t.calories) / t.calories > 0.1) {
      issues.push({ code: "calories_off", severity: "major", message: `day totals ${totals.calories} kcal vs target ${t.calories} kcal` });
    }
    if (t.protein > 0 && totals.protein < t.protein * 0.88) {
      issues.push({ code: "protein_low", severity: "major", message: `protein ${totals.protein} g vs target ${t.protein} g` });
    }
    const fiberTarget = Math.round((totals.calories / 1000) * 14 * 0.7);
    if (totals.fiber < fiberTarget) {
      issues.push({ code: "low_fiber", severity: "minor", message: `fiber ${totals.fiber} g (aim for ≥ ${fiberTarget} g — more vegetables, fruit, legumes, whole grains)` });
    }
  }
  if (totalKcal > 0 && wholeKcal / totalKcal < 0.75) {
    issues.push({ code: "low_whole_food_share", severity: "minor", message: `only ${Math.round((wholeKcal / totalKcal) * 100)}% of calories from whole/minimally processed foods` });
  }
  if (totalKcal > 0 && estimatedKcal / totalKcal > 0.3) {
    issues.push({ code: "many_estimates", severity: "minor", message: "many foods had no reference data — numbers are estimates" });
  }
  if (vegCount === 0 && plan.meals.length >= 2) {
    issues.push({ code: "no_vegetables", severity: "minor", message: "no vegetables in the day" });
  }
  const dayKcal = plan.daily_totals?.calories ?? 0;
  if (dayKcal > 0 && plan.meals.length > 1) {
    const shares = mealCalorieShares(plan.meals.map((m) => m.slot));
    for (const meal of plan.meals) {
      const share = shares.get(meal.slot) ?? 0;
      if (share > 0 && meal.calories > dayKcal * share * MEAL_HEAVY_FACTOR) {
        issues.push({
          code: "meal_unbalanced",
          severity: "minor",
          message: `${meal.slot} carries ${Math.round((meal.calories / dayKcal) * 100)}% of the day's calories (aim ≈ ${Math.round(share * 100)}%)`,
        });
      }
    }
  }
  return issues;
}

export function blockingIssues(issues: readonly NutritionIssue[]): NutritionIssue[] {
  return issues.filter((i) => i.severity !== "minor");
}

export function formatIssuesForPrompt(issues: readonly NutritionIssue[]): string {
  return issues.slice(0, 12).map((i) => `- ${i.message}`).join("\n");
}
