/**
 * Production nutrition pipeline (pure; the model call is injected):
 *
 *   message → intent (caller) → user context → dietary constraints (rules +
 *   optional semantic model pass) → targets → food filtering → generation →
 *   macro calculation → constraint / nutrition / simplicity validation →
 *   deterministic fixes → (one regeneration if still failing) → final plan.
 */

import { FOOD_CATALOG, getFood, type FoodItem, type FoodLang } from "@/lib/ai/food-catalog";
import { isPracticalMenuFood } from "@/lib/ai/food-availability";
import { buildDayVariants, dayMenuLabel, planDayMenus, weeklyGroceryList } from "@/lib/ai/nutrition-day-variants";
import { isFoodAllowed } from "@/lib/ai/food-swap";
import { buildIntakeContextForAi } from "@/lib/ai/intake-context";
import { buildPlanTextLanguageRule } from "@/lib/ai/language-instructions";
import { fitPortionsToTargets, recalculateNutritionPlan, splitCompoundIngredient } from "@/lib/ai/nutrition-calc";
import { buildNutritionRequestContext, type NutritionRequestContext } from "@/lib/ai/nutrition-context";
import {
  autoFixNutritionPlan,
  buildNutritionConstraintPromptBlock,
  findFoodViolations,
  mergeSemanticConstraints,
  resolveNutritionConstraints,
  type NutritionConstraints,
  type SemanticDietaryItem,
} from "@/lib/ai/nutrition-constraints";
import {
  blockingIssues,
  enforceMealSlots,
  ensureCarbSources,
  ensureFatSource,
  ensureVegetables,
  formatIssuesForPrompt,
  makeFoodSafe,
  markGlutenFreeOats,
  normalizePortions,
  replaceProblemIngredients,
  rotationNotes,
  simplifyMeals,
  validateNutritionPlan,
  type NutritionIssue,
  type QualityContext,
} from "@/lib/ai/nutrition-quality";
import { parseJsonObject } from "@/lib/ai/parse-json";
import { withPlanMedicalDisclaimer } from "@/lib/ai/plan-medical-disclaimer";
import type {
  AiGeneratedNutritionPlan,
  AiNutritionIngredient,
  AiNutritionMeal,
} from "@/lib/ai/plan-builder-types";
import { nutritionGoalRulesForAi } from "@/lib/goal-coaching";
import { profileToResponses } from "@/lib/intake-questionnaire";
import type { Profile } from "@/lib/types";

export type NutritionGenerationInput = {
  /** Chronological user turns (latest LAST) — food exclusions persist across turns. */
  conversation?: readonly string[];
  /** Prompt-only context (e.g. current plan JSON) — never parsed for constraints. */
  baseContext?: string;
};

export type NutritionRequest = {
  profile: Profile;
  preferences?: string;
  conversation: readonly string[];
  baseContext?: string;
  constraints: NutritionConstraints;
  context: NutritionRequestContext;
};

export function qualityContextOf(req: NutritionRequest): QualityContext {
  return {
    constraints: req.constraints,
    style: req.context.style,
    slots: req.context.slots,
    targets: req.context.targets,
    requestedFoodIds: req.context.requestedFoodIds,
    allowedProcessedIds: req.context.allowedProcessedIds,
    lang: req.context.lang,
    region: req.context.region,
  };
}

/** User context aggregation + constraint extraction + target calculation. */
export function buildNutritionRequest(
  profile: Profile,
  preferences?: string,
  input?: NutritionGenerationInput
): NutritionRequest {
  const responses = profileToResponses(profile);
  const conversation = input?.conversation ?? [];
  const constraints = resolveNutritionConstraints(
    {
      diet_type: responses.diet_type,
      food_allergies: responses.food_allergies,
      food_dislikes: responses.food_dislikes,
    },
    conversation,
    preferences
  );
  return {
    profile,
    preferences,
    conversation,
    baseContext: input?.baseContext,
    constraints,
    context: buildNutritionRequestContext(profile, conversation, preferences),
  };
}

export function withSemanticConstraints(req: NutritionRequest, items: readonly SemanticDietaryItem[]): NutritionRequest {
  const merged = mergeSemanticConstraints(req.constraints, items, {
    latestMessage: req.conversation.at(-1) ?? req.preferences ?? null,
  });
  return merged === req.constraints ? req : { ...req, constraints: merged };
}

// ─── Food filtering ─────────────────────────────────────────────────────────

/** Foods the model should build from: allowed, whole-food-first, available where the client shops. */
export function selectMenuFoods(req: NutritionRequest): FoodItem[] {
  const { style, requestedFoodIds, allowedProcessedIds, region } = req.context;
  const requested = new Set([...requestedFoodIds, ...allowedProcessedIds]);
  const allowLimited = style.complexity === "variety" || style.complexity === "recipes";
  return FOOD_CATALOG.filter(
    (f) =>
      isFoodAllowed(f, req.constraints) &&
      isPracticalMenuFood(f, { region, allowLimited, budget: style.budget, requested })
  );
}

function menuBlock(req: NutritionRequest): string {
  const foods = selectMenuFoods(req);
  const groups: [string, (f: FoodItem) => boolean][] = [
    ["Protein", (f) => f.role === "protein"],
    ["Carbs", (f) => f.role === "carb"],
    ["Vegetables", (f) => f.role === "vegetable"],
    ["Fruit", (f) => f.role === "fruit"],
    ["Fats", (f) => f.role === "fat"],
    ["Other", (f) => f.role === "mixed"],
  ];
  return groups
    .map(([label, pick]) => {
      const names = foods.filter(pick).map((f) => f.name);
      return names.length ? `- ${label}: ${names.join(", ")}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

const COMPLEXITY_RULES: Record<NutritionRequestContext["style"]["complexity"], string> = {
  very_simple: "VERY SIMPLE: 2–3 foods per meal, repeat foods freely, almost no cooking (boil, microwave, assemble).",
  simple: "SIMPLE (default): 3–4 foods per meal (protein + carb + vegetable/fruit, + a fat where useful). Minimal cooking, no recipes.",
  meal_prep: "MEAL PREP: lunch and dinner reuse 1–2 batch-cooked proteins and carbs (cook twice a week); 3–4 foods per meal; stores well.",
  variety: "MORE VARIETY: still 3–5 foods per meal, but use different proteins/carbs/vegetables across meals; no complicated recipes.",
  recipes: "RECIPES: meals may be simple home recipes (≤ 7 foods, ≤ 3 short steps in the description). Still common ingredients.",
};

/** The generation prompt. Numbers are recomputed by code — the model picks foods and rough portions. */
export function buildNutritionPrompt(req: NutritionRequest, feedback?: string | null): string {
  const { context } = req;
  const intake = buildIntakeContextForAi(req.profile);
  const constraintBlock = buildNutritionConstraintPromptBlock(req.constraints);
  const recent = req.conversation.slice(-6).map((t) => `- "${t.slice(0, 400)}"`).join("\n");
  const slotsJson = context.slots.map((s) => `"${s}"`).join(" | ");

  const prompt = `You are an experienced, practical nutrition coach. Your motto: "Let's make this simple enough that you can actually follow it."

CLIENT PROFILE:
${intake}

PLAN SETTINGS (computed from the profile and conversation — follow them):
${context.summaryLines.map((l) => `- ${l}`).join("\n")}
${context.safetyFlags.length ? `SAFETY:\n${context.safetyFlags.map((l) => `- ${l}`).join("\n")}\n` : ""}
${recent ? `CLIENT MESSAGES (raw, oldest → newest; the newest wins on conflicts):\n${recent}\n` : ""}${req.baseContext?.trim() ? `\n${req.baseContext.trim()}\n` : ""}
${req.preferences?.trim() ? `REQUEST (latest instruction — highest priority):\n${req.preferences.trim()}\n` : ""}
${constraintBlock}

${nutritionGoalRulesForAi(context.goal)}

HOW TO BUILD THE DAY:
- Whole and minimally processed foods are the default. Cooking is fine (grilled, boiled, baked, scrambled). Frozen vegetables, canned beans/tuna, plain yogurt, milk and whole-grain bread are fine.
- Meat, poultry, fish and eggs are always cooked — never raw meat, raw fish, raw eggs, tartare, carpaccio or raw-egg drinks.
- Do NOT use candy, chips, cookies, cakes, pastries, sugary cereal, soft drinks, juice, fast food, ready meals, protein bars or protein powder unless the client explicitly asked for them.
- ${COMPLEXITY_RULES[context.style.complexity]}${context.style.quick ? " Keep prep under ~15 minutes per meal (eggs, yogurt, canned fish/legumes, microwave rice, salad)." : ""}${context.style.budget ? " Budget-friendly: eggs, legumes, oats, rice, potatoes, frozen veg, seasonal fruit, cheaper cuts." : ""}
- Meal template: protein + carbohydrate + vegetable/fruit (+ a healthy fat). Snacks: protein + fruit or a small handful of nuts.
- Exactly one meal for each of these slots and no others: ${context.slots.join(", ")}.
- Use a broad but small set of foods: different vegetables at lunch and dinner, whole fruit (not juice).
- Build meals from this FOOD LIST (use these names in "food"; common seasonings like salt, pepper, herbs, lemon, garlic are always fine):
${menuBlock(req)}
- One food per ingredient line. Amounts: grams for meat/fish (cooked weight), rice/pasta/potatoes (cooked weight) and oats (dry weight); counts for eggs, fruit and bread ("3", "1 medium", "2 slices"); "tbsp" for oils and nut butters; "ml" for milk.
- Aim portions at the daily targets; code will recalculate the numbers exactly from your foods.
- Meal names must be plain ("Eggs, oats & banana"). Descriptions: one short sentence or empty.
- coach_notes: 1–2 short practical tips. No fear-based claims ("toxic", "poison", "clean vs dirty") — explain practically.

${buildPlanTextLanguageRule(req.profile.preferred_locale)}
Ingredient "food" values stay in English exactly as in the FOOD LIST (they are internal keys); "name" is shown to the client.

Respond with ONLY valid JSON:
{
  "title": "short plan name",
  "description": "1 sentence: how this fits the client",
  "meals": [
    {
      "slot": ${slotsJson},
      "name": "plain meal name",
      "description": "",
      "ingredients": [{ "name": "food as shown to client", "amount": "150g", "food": "exact FOOD LIST name" }]
    }
  ],
  "coach_notes": ["practical tip"]
}`;
  return feedback
    ? `${prompt}\n\nYOUR PREVIOUS ANSWER FAILED THESE CHECKS — fix every item and return the full corrected JSON:\n${feedback}`
    : prompt;
}

// ─── Raw → normalized plan ─────────────────────────────────────────────────

const VALID_SLOTS = new Set<AiNutritionMeal["slot"]>(["breakfast", "snack_1", "lunch", "snack_2", "dinner"]);
const FEAR_RE = /\b(?:poison\w*|toxic|toxins?|chemicals?|detox\w*|clean eating|dirty food|junk will|kills? you|makes? you (?:sick|fat))\b/i;
const DISCLAIMER_RE = /\bnot (?:a|your) (?:doctor|physician|dietitian)\b|\bmedical advice\b/i;

function toIngredient(raw: unknown): AiNutritionIngredient | null {
  if (typeof raw === "string") {
    const name = raw.trim();
    return name ? { name } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;
  const amount = typeof r.amount === "string" ? r.amount.trim() : typeof r.amount === "number" ? `${r.amount}g` : "";
  const foodName = typeof r.food === "string" ? r.food.trim() : "";
  const food = foodName ? FOOD_CATALOG.find((f) => f.name.toLowerCase() === foodName.toLowerCase() || f.id === foodName) : undefined;
  return { name, ...(amount ? { amount } : {}), ...(food ? { food: food.id } : foodName ? { food: foodName } : {}) };
}

export function normalizeRawNutritionPlan(raw: unknown, req: NutritionRequest): AiGeneratedNutritionPlan {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const meals: AiNutritionMeal[] = (Array.isArray(r.meals) ? r.meals : [])
    .map((m): AiNutritionMeal | null => {
      if (!m || typeof m !== "object") return null;
      const mm = m as Record<string, unknown>;
      const slot = mm.slot as AiNutritionMeal["slot"];
      const name = typeof mm.name === "string" ? mm.name.trim() : "";
      if (!name || !VALID_SLOTS.has(slot)) return null;
      const ingredients = (Array.isArray(mm.ingredients) ? mm.ingredients : [])
        .map(toIngredient)
        .filter((i): i is AiNutritionIngredient => i !== null)
        .flatMap((i) => splitCompoundIngredient(i, req.context.lang))
        .map((i) => (i.food && !getFood(i.food) ? { name: i.name, amount: i.amount } : i));
      return {
        slot,
        name,
        description: typeof mm.description === "string" ? mm.description.trim() : "",
        calories: Number(mm.calories) || 0,
        protein: Number(mm.protein) || 0,
        carbs: Number(mm.carbs) || 0,
        fat: Number(mm.fat) || 0,
        ingredients,
      };
    })
    .filter((m): m is AiNutritionMeal => m !== null);
  const notes = (Array.isArray(r.coach_notes) ? r.coach_notes : [])
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    .map((n) => n.trim())
    .filter((n) => !FEAR_RE.test(n) && !DISCLAIMER_RE.test(n))
    .slice(0, 2);
  return {
    title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : "Simple Whole-Food Plan",
    description: typeof r.description === "string" ? r.description.trim() : "",
    daily_targets: { ...req.context.targets },
    meals,
    coach_notes: notes,
  };
}

// ─── Finalize (deterministic, testable) ────────────────────────────────────

export type FinalizedNutritionPlan = {
  plan: AiGeneratedNutritionPlan;
  issues: NutritionIssue[];
  fixes: string[];
};

const NOTES: Record<
  FoodLang,
  {
    wholeFood: string;
    rules: (items: string) => string;
    processed: (items: string) => string;
    estimates: string;
    menus: (labels: string) => string;
  }
> = {
  en: {
    wholeFood:
      "Built mostly from whole and minimally processed foods — it makes protein, fiber, vitamins and minerals easy to hit and keeps the day less dependent on snack foods and sugary drinks.",
    rules: (items) => `Adjusted to your food rules — swapped out: ${items}. Totals are recalculated from the final foods.`,
    processed: (items) => `Swapped highly processed items for whole foods: ${items}.`,
    estimates: "Numbers marked ~ are estimates — a few foods had no reference data.",
    menus: (labels) =>
      `${labels} rotate through the week (A, B, C, A…) — each hits the same targets, and the grocery list covers all of them.`,
  },
  al: {
    wholeFood:
      "Plani mbështetet kryesisht te ushqime të plota dhe pak të përpunuara — kështu arrin më lehtë proteinat, fibrat, vitaminat dhe mineralet, pa u varur nga snack-et dhe pijet me sheqer.",
    rules: (items) => `E përshtata sipas rregullave të tua për ushqimin — hoqa: ${items}. Totalet janë rillogaritur nga ushqimet përfundimtare.`,
    processed: (items) => `Zëvendësova ushqimet shumë të përpunuara me ushqime të plota: ${items}.`,
    estimates: "Numrat me ~ janë vlerësime — për disa ushqime nuk kishte të dhëna referuese.",
    menus: (labels) =>
      `${labels} ndërrohen gjatë javës (A, B, C, A…) — secila arrin të njëjtat objektiva dhe lista e blerjeve i përfshin të gjitha.`,
  },
};

function listItems(items: readonly string[]): string {
  const seen = new Map<string, string>();
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, item.trim());
  }
  const list = [...seen.values()];
  return `${list.slice(0, 6).join(", ")}${list.length > 6 ? "…" : ""}`;
}

export function finalizeNutritionPlan(raw: unknown, req: NutritionRequest): FinalizedNutritionPlan {
  const ctx = qualityContextOf(req);
  let plan = normalizeRawNutritionPlan(raw, req);
  const fixes: string[] = [];
  const ruleFixes: string[] = [];

  const step = (res: { plan: AiGeneratedNutritionPlan; fixes: string[] }, into = fixes) => {
    plan = res.plan;
    into.push(...res.fixes);
  };

  step(enforceMealSlots(plan, ctx));
  step(makeFoodSafe(plan));
  const replaced = replaceProblemIngredients(plan, ctx);
  step(replaced, ruleFixes);
  const ruleItems = replaced.replaced.filter((r) => r.reason === "constraint").map((r) => r.from);
  const processedItems = replaced.replaced.filter((r) => r.reason === "processed").map((r) => r.from);
  if (findFoodViolations(plan, req.constraints).length) {
    const text = autoFixNutritionPlan(plan, req.constraints);
    plan = { ...text.plan, coach_notes: plan.coach_notes };
    ruleFixes.push(...text.changes);
    ruleItems.push(...text.changes.map((c) => c.split(" → ")[0]!.replace(/^removed /, "")));
  }
  const lang = req.context.lang;
  const text = NOTES[lang];
  plan = markGlutenFreeOats(plan, req.constraints, lang);
  step(simplifyMeals(plan, ctx));
  step(ensureCarbSources(plan, ctx));
  step(ensureVegetables(plan, ctx));
  step(ensureFatSource(plan, ctx));
  step(normalizePortions(plan, lang));
  const fit = fitPortionsToTargets(plan, req.context.targets, { lang });
  plan = fit.plan;
  if (fit.adjusted.length) fixes.push(`portions adjusted to targets (${fit.adjusted.length})`);
  plan = recalculateNutritionPlan(plan);
  plan = { ...plan, daily_targets: { ...req.context.targets } };

  const variants = buildDayVariants(plan, ctx, req.context.menuCount);
  if (variants.length) plan = { ...plan, day_label: dayMenuLabel(0, lang), day_variants: variants };
  const menus = planDayMenus(plan);
  plan = { ...plan, grocery_list: weeklyGroceryList(plan, lang) };

  const notes = [
    ...req.constraints.notes,
    ...req.context.safetyNotes,
    ...(ruleItems.length ? [text.rules(listItems(ruleItems))] : []),
    ...(processedItems.length ? [text.processed(listItems(processedItems))] : []),
    text.wholeFood,
    ...(variants.length ? [text.menus(menus.map((m) => m.label).join(", "))] : rotationNotes(plan, ctx)),
    ...(menus.some((m) => m.nutrition_estimated) ? [text.estimates] : []),
    ...plan.coach_notes,
  ];
  plan = { ...plan, coach_notes: withPlanMedicalDisclaimer([...new Set(notes)], req.profile.preferred_locale) };

  return { plan, issues: validateNutritionPlan(plan, ctx), fixes: [...ruleFixes, ...fixes] };
}

function issueScore(issues: readonly NutritionIssue[]): number {
  return issues.reduce((acc, i) => acc + (i.severity === "hard" ? 100 : i.severity === "major" ? 10 : 1), 0);
}

export type NutritionPipelineDeps = {
  /** Model call: prompt → raw JSON text. */
  generate: (prompt: string) => Promise<string>;
  /** Optional semantic constraint pass (runs in parallel with the first generation). */
  extractSemantic?: (texts: readonly string[]) => Promise<SemanticDietaryItem[]>;
};

export type NutritionPipelineResult = FinalizedNutritionPlan & { attempts: number; request: NutritionRequest };

export async function runNutritionPipeline(
  initial: NutritionRequest,
  deps: NutritionPipelineDeps
): Promise<NutritionPipelineResult> {
  const texts = [...initial.conversation, initial.preferences ?? ""].filter((t) => t.trim());
  const semanticPromise =
    deps.extractSemantic && texts.length
      ? deps.extractSemantic(texts).catch(() => [] as SemanticDietaryItem[])
      : Promise.resolve([] as SemanticDietaryItem[]);

  const [firstRaw, semantic] = await Promise.all([
    deps.generate(buildNutritionPrompt(initial)).catch(() => null),
    semanticPromise,
  ]);
  const req = withSemanticConstraints(initial, semantic);

  const parse = (text: string | null): unknown => {
    if (!text) return {};
    try {
      return parseJsonObject(text);
    } catch {
      return {};
    }
  };

  let best = finalizeNutritionPlan(parse(firstRaw), req);
  let attempts = 1;
  const blocking = blockingIssues(best.issues);
  if (!firstRaw || blocking.length) {
    attempts = 2;
    const feedback = firstRaw ? formatIssuesForPrompt(blocking) : null;
    const retryRaw = await deps.generate(buildNutritionPrompt(req, feedback)).catch(() => null);
    if (retryRaw) {
      const retry = finalizeNutritionPlan(parse(retryRaw), req);
      if (issueScore(retry.issues) <= issueScore(best.issues)) best = retry;
    } else if (!firstRaw) {
      throw new Error("Nutrition plan generation failed. Please try again.");
    }
  }
  return { ...best, attempts, request: req };
}
