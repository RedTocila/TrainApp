/**
 * Nutrition user-context aggregation: profile + conversation → targets, meal
 * structure, complexity, practicality flags and safety flags. Pure.
 */

import { FOOD_CATALOG, matchFoods, type FoodLang } from "@/lib/ai/food-catalog";
import { REGION_LABEL, resolveFoodRegion, type FoodRegion } from "@/lib/ai/food-availability";
import { normalizeUserText, parseConstraintText } from "@/lib/ai/constraint-language";
import { calculateMacrosFromProfile } from "@/lib/macro-calculator";
import { consistentTargets, type MacroTargets } from "@/lib/ai/nutrition-calc";
import { profileToResponses } from "@/lib/intake-questionnaire";
import type { AiNutritionMeal } from "@/lib/ai/plan-builder-types";
import type { Profile } from "@/lib/types";

export type MealSlotId = AiNutritionMeal["slot"];

export type NutritionComplexity = "very_simple" | "simple" | "meal_prep" | "variety" | "recipes";

export type NutritionStyle = {
  complexity: NutritionComplexity;
  quick: boolean;
  budget: boolean;
  /** Client asked for low-carb / keto — don't add starch sides. */
  lowCarb?: boolean;
};

export type TargetSource = "request" | "profile" | "formula" | "default";

export type NutritionRequestContext = {
  goal: string | null;
  sex: string | null;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  trainingDays: string | null;
  trainingTime: string | null;
  cooking: string | null;
  mealsPerDay: number;
  slots: MealSlotId[];
  style: NutritionStyle;
  /** Distinct daily menus rotated through the week (1 = the same menu every day). */
  menuCount: number;
  targets: MacroTargets;
  targetSource: TargetSource;
  /** Catalog foods the client explicitly asked for (may include processed ones). */
  requestedFoodIds: Set<string>;
  /** Highly processed catalog foods the client explicitly asked for. */
  allowedProcessedIds: Set<string>;
  /** Shown to the client in coach_notes (safety / clamped requests). */
  safetyNotes: string[];
  /** Prompt-only safety context. */
  safetyFlags: string[];
  locale: string | null;
  /** Language for code-generated food names and notes. */
  lang: FoodLang;
  /** Where the client shops (from chat mentions, else app language). */
  region: FoodRegion;
  /** Compact settings block for the generation prompt. */
  summaryLines: string[];
};

const ALL_SLOTS: MealSlotId[] = ["breakfast", "snack_1", "lunch", "snack_2", "dinner"];

const COMPLEXITY_RULES: { re: RegExp; value: NutritionComplexity }[] = [
  { re: /\b(?:meal[\s-]?prep(?:ping)?|batch[\s-]?cook(?:ing)?|cook once|prep (?:on|for) (?:sunday|the week)|same meals? (?:every|each) day)\b/, value: "meal_prep" },
  { re: /\b(?:more variety|variety|different (?:foods|meals) (?:every|each) day|less repetitive|mix it up|bored of (?:eating )?the same|switch it up)\b/, value: "variety" },
  { re: /\b(?:more recipes|recipes?|something (?:fancier|more interesting)|i (?:love|like|enjoy) (?:to )?cook(?:ing)?)\b/, value: "recipes" },
  { re: /\b(?:very simple|super simple|as simple as possible|dead simple|simplest|minimal(?:ist)?|lazy|no[\s-]brainer|keep it (?:really|super) simple)\b/, value: "very_simple" },
  { re: /\b(?:simple|easy|basic|straightforward)\b/, value: "simple" },
];

const QUICK_RE =
  /\b(?:quick|fast (?:meals?|to make|food)|no time|busy|in a hurry|under \d+ ?min(?:ute)?s?|no[\s-]cook|minimal cooking|little time|don't have time to cook|i (?:don't|can't) cook|hate cooking)\b/;
const NOT_QUICK_RE = /\b(?:i (?:love|like|enjoy) (?:to )?cook(?:ing)?|plenty of time|time to cook)\b/;
const LOW_CARB_RE = /\b(?:low[\s-]?carb|keto(?:genic)?|no carbs|cut(?:ting)? carbs|pak karbohidrat\w*|pa karbohidrat\w*)\b/;
const NOT_LOW_CARB_RE = /\b(?:more carbs|add (?:back )?carbs|carbs are fine|not low[\s-]?carb)\b/;
const BUDGET_RE = /\b(?:budget|cheap|affordable|inexpensive|low[\s-]cost|save money|broke|student budget|tight on money)\b/;
const NOT_BUDGET_RE = /\b(?:money (?:is|isn't) (?:not )?(?:a|an) (?:issue|problem)|budget (?:is|isn't) (?:not )?(?:a|an) (?:issue|problem)|no budget)\b/;

const WORD_NUM: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, dy: 2, tre: 3, kater: 4, pese: 5, gjashte: 6, shtate: 7 };

const SAME_EVERY_DAY_RE =
  /\b(?:same (?:meals?|menu|food|thing) (?:every|each) day|eat the same (?:thing|meals?)(?: every day)?|one (?:daily )?menu|repeat (?:the same|it) (?:every|each) day|i don't (?:need|want) variety|njejt\w* (?:ushqim|menu) (?:cdo|çdo) dite)\b/;
const DIFFERENT_EVERY_DAY_RE =
  /\b(?:different (?:meals?|foods?|menus?) (?:every|each) day|not the same (?:meals?|food) every day|a different menu (?:every|each) day|menu (?:te|të) ndryshme (?:cdo|çdo) dite)\b/;
const MENU_COUNT_RE =
  /\b([2-7]|two|three|four|five|six|seven|dy|tre|kater|pese|gjashte|shtate)\s+(?:different\s+|rotating\s+)?(?:daily\s+)?(?:menus?|day menus?|meal days|days of meals|daily plans|menu (?:te|të) ndryshme|menu)\b/;

const DEFAULT_MENU_COUNT: Record<NutritionComplexity, number> = {
  very_simple: 1,
  simple: 3,
  meal_prep: 2,
  variety: 4,
  recipes: 3,
};
const MEALS_RE = /\b([2-6]|two|three|four|five|six)\s+(?:meals?|eating occasions|times a day|vakte|vakt)\b/;
const SKIP_BREAKFAST_RE =
  /\b(?:no breakfast|skip(?:ping)? breakfast|without breakfast|don't (?:eat|have|do) breakfast|not a breakfast person|breakfast (?:doesn't|does not) work|intermittent fasting|16[:/]8|18[:/]6|fasting window|i fast (?:until|till) (?:noon|lunch))\b/;
const WANT_BREAKFAST_RE = /\b(?:add (?:a |back )?breakfast|i (?:do )?eat breakfast now|include breakfast|with breakfast)\b/;
const NO_SNACKS_RE = /\b(?:no snacks?|without snacks?|skip (?:the )?snacks?|don't snack|no snacking|just (?:three|3|two|2) (?:main )?meals)\b/;
const WANT_SNACK_RE = /\b(?:add (?:a |some )?snacks?|with snacks?|more snacks|include (?:a )?snacks?)\b/;

const KCAL_RE = /\b(\d{3,4})[\s-]*(?:kcal|k?cals?|calories?)\b/;
const PROTEIN_RE = /\b(\d{2,3})\s*g(?:rams)?\s*(?:of\s+)?protein\b|\bprotein\s*(?:of|at|to)?\s*(\d{2,3})\s*g\b/;
const HIGH_PROTEIN_RE = /\b(?:high[\s-]protein|more protein|extra protein|protein[\s-]heavy)\b/;

const PREGNANCY_RE = /\b(?:pregnan\w*|breastfeeding|breast feeding|nursing (?:mom|mother)|expecting a baby|shtatzan\w*)\b/;
const ED_RE = /\b(?:eating disorder|anorexi\w*|bulimi\w*|binge(?:ing)? (?:eating|and purg)|purg(?:e|ing)|orthorexi\w*|arfid)\b/;
const MEDICAL_RE = /\b(?:diabet\w*|insulin|kidney|renal|ckd|liver disease|heart disease|hypertension|high blood pressure|cholesterol|gout|ibs|crohn'?s|colitis|celiac|coeliac|thyroid|pcos|medication|meds|warfarin|metformin|ozempic|semaglutide|chemo\w*|cancer)\b/;
const EXTREME_RE = /\b(?:juice cleanse|detox (?:diet|cleanse)|water fast\w*|only water|crash diet|starv\w*|stop eating|eat nothing|(?:[1-7]\d\d|[1-9]\d)\s*(?:kcal|calories?) a day)\b/;

function numberFrom(token: string): number {
  return WORD_NUM[token] ?? Number(token);
}

function calorieFloor(sex: string | null): number {
  return sex === "female" ? 1200 : 1500;
}

const REQUEST_CUE_RE = /\b(?:i (?:want|like|love|need|prefer|enjoy|usually have|always have)|include|add|put in|with|keep|can i have|let me have|i'?m fine with|allow|use)\b/;

/** Catalog foods the client asked for in their own (non-negated) words. */
function requestedFoodsFromTexts(texts: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const text of texts) {
    const positive = parseConstraintText(text).positive;
    if (!positive || !REQUEST_CUE_RE.test(positive)) continue;
    for (const m of matchFoods(positive)) out.add(m.food.id);
  }
  return out;
}

export function chooseMealSlots(opts: {
  mealsPerDay: number;
  skipBreakfast: boolean;
  noSnacks: boolean;
}): MealSlotId[] {
  const n = Math.min(5, Math.max(2, opts.mealsPerDay));
  let slots: MealSlotId[];
  if (n >= 5) slots = [...ALL_SLOTS];
  else if (n === 4) slots = ["breakfast", "lunch", "snack_2", "dinner"];
  else if (n === 3) slots = ["breakfast", "lunch", "dinner"];
  else slots = ["lunch", "dinner"];
  if (opts.skipBreakfast) {
    slots = slots.filter((s) => s !== "breakfast" && s !== "snack_1");
    if (n >= 3 && !slots.includes("snack_2") && !opts.noSnacks) slots = ["lunch", "snack_2", "dinner"];
  }
  if (opts.noSnacks) slots = slots.filter((s) => s !== "snack_1" && s !== "snack_2");
  if (slots.length < 2) slots = ["lunch", "dinner"];
  return ALL_SLOTS.filter((s) => slots.includes(s));
}

function profileMealsPerDay(value?: string | null): number | null {
  if (!value) return null;
  if (value === "5_plus") return 5;
  const n = Number(value);
  return Number.isFinite(n) && n >= 2 ? n : null;
}

function resolveTargets(
  profile: Profile,
  texts: readonly string[],
  sex: string | null,
  weightKg: number | null,
  goal: string | null,
  noDeficit: boolean,
  notes: string[]
): { targets: MacroTargets; source: TargetSource } {
  let source: TargetSource;
  let base: MacroTargets;
  if (profile.target_calories && profile.target_calories > 0) {
    base = {
      calories: profile.target_calories,
      protein: profile.target_protein ?? 0,
      carbs: profile.target_carbs ?? 0,
      fat: profile.target_fat ?? 0,
    };
    source = "profile";
  } else {
    const formula = calculateMacrosFromProfile(profile);
    if (formula) {
      base = formula;
      source = "formula";
    } else {
      base = sex === "female"
        ? { calories: 1900, protein: 120, carbs: 210, fat: 63 }
        : { calories: 2300, protein: 150, carbs: 260, fat: 75 };
      source = "default";
    }
  }
  if (!base.protein) base.protein = Math.round(weightKg ? weightKg * 1.6 : (base.calories * 0.25) / 4);
  if (!base.fat) base.fat = Math.round((base.calories * 0.28) / 9);

  if (noDeficit && goal === "lose_weight") {
    const maintenance = calculateMacrosFromProfile({ ...profile, goal: "stay_fit", intake_responses: profile.intake_responses ? { ...profile.intake_responses, goal: "stay_fit" } : profile.intake_responses });
    if (maintenance && maintenance.calories > base.calories) {
      base = { ...base, calories: maintenance.calories };
      notes.push("Calories are set near maintenance rather than a deficit — with the health situation you mentioned, any weight-loss target should be set with your doctor or a registered dietitian.");
    }
  }

  let requested: number | null = null;
  let requestedProtein: number | null = null;
  let highProtein = false;
  for (const raw of texts) {
    const t = normalizeUserText(raw);
    const k = t.match(KCAL_RE);
    if (k && !/\bburn(?:ed|t)?\b/.test(t)) requested = Number(k[1]);
    const p = t.match(PROTEIN_RE);
    if (p) requestedProtein = Number(p[1] ?? p[2]);
    if (HIGH_PROTEIN_RE.test(t)) highProtein = true;
  }

  let targets = { ...base };
  if (requested != null) {
    const floor = calorieFloor(sex);
    const cal = Math.min(6000, Math.max(floor, requested));
    if (cal !== requested) {
      notes.push(`I set calories to ${cal} instead of ${requested} — going that low isn't something to do without a doctor or registered dietitian supervising it.`);
    }
    targets = { ...targets, calories: cal, fat: Math.round((cal * 0.28) / 9) };
    source = "request";
  }
  if (requestedProtein != null && requestedProtein >= 40 && requestedProtein <= 350) {
    targets.protein = requestedProtein;
    source = "request";
  } else if (highProtein) {
    const high = weightKg ? Math.round(weightKg * 2) : Math.round(targets.protein * 1.2);
    targets.protein = Math.max(targets.protein, Math.min(high, Math.round((targets.calories * 0.4) / 4)));
  }
  const floor = calorieFloor(sex);
  if (targets.calories < floor) {
    notes.push(`Calories are kept at ${floor} minimum — lower intakes need medical supervision.`);
    targets.calories = floor;
  }
  targets.carbs = Math.max(50, Math.round((targets.calories - targets.protein * 4 - targets.fat * 9) / 4));
  return { targets: consistentTargets(targets), source };
}

export function buildNutritionRequestContext(
  profile: Profile,
  conversation: readonly string[] = [],
  preferences?: string | null
): NutritionRequestContext {
  const responses = profileToResponses(profile);
  const texts = [...conversation.slice(0, -1), preferences ?? "", conversation.at(-1) ?? ""].filter((s) => s.trim());
  const normalized = texts.map((t) => normalizeUserText(t));
  const all = normalized.join(" \n ");
  const sex = (responses.gender ?? profile.gender ?? null) as string | null;
  const weightKg = responses.intake_weight_kg ?? profile.intake_weight_kg ?? null;
  const goal = responses.goal ?? profile.goal ?? null;

  let complexity: NutritionComplexity = "simple";
  let quick = responses.cooking_frequency === "rarely";
  let budget = false;
  let lowCarb = false;
  let mealsPerDay = profileMealsPerDay(responses.meals_per_day) ?? (goal === "gain_weight" ? 5 : 4);
  let skipBreakfast = false;
  let noSnacks = false;
  let wantsSnack = false;
  let explicitMenus: number | null = null;

  for (const t of normalized) {
    const pos = parseConstraintText(t).positive || t;
    if (SAME_EVERY_DAY_RE.test(pos)) explicitMenus = 1;
    if (DIFFERENT_EVERY_DAY_RE.test(pos)) explicitMenus = 7;
    const mc = pos.match(MENU_COUNT_RE);
    if (mc) explicitMenus = Math.min(7, Math.max(1, numberFrom(mc[1]!)));
    const hit = COMPLEXITY_RULES.find((r) => r.re.test(pos));
    if (hit) complexity = hit.value;
    if (QUICK_RE.test(t)) quick = true;
    if (NOT_QUICK_RE.test(t)) quick = false;
    if (BUDGET_RE.test(t) && !NOT_BUDGET_RE.test(t)) budget = true;
    if (LOW_CARB_RE.test(pos)) lowCarb = true;
    if (NOT_LOW_CARB_RE.test(t)) lowCarb = false;
    const m = t.match(MEALS_RE);
    if (m) mealsPerDay = numberFrom(m[1]!);
    if (SKIP_BREAKFAST_RE.test(t)) skipBreakfast = true;
    if (WANT_BREAKFAST_RE.test(t)) skipBreakfast = false;
    if (NO_SNACKS_RE.test(t)) {
      noSnacks = true;
      wantsSnack = false;
    }
    if (WANT_SNACK_RE.test(t)) {
      wantsSnack = true;
      noSnacks = false;
    }
  }
  if (wantsSnack && !MEALS_RE.test(all)) mealsPerDay = Math.max(mealsPerDay, 4);
  const slots = chooseMealSlots({ mealsPerDay, skipBreakfast, noSnacks });

  const safetyNotes: string[] = [];
  const safetyFlags: string[] = [];
  const conditions = (responses.health_conditions ?? []).filter((c) => c !== "none");
  const profileMedical = [conditions.join(" "), responses.health_condition_details ?? "", responses.medications ?? "", profile.medical_conditions ?? ""]
    .join(" ")
    .toLowerCase();
  const pregnancy = PREGNANCY_RE.test(all) || PREGNANCY_RE.test(profileMedical);
  const ed = ED_RE.test(all) || ED_RE.test(profileMedical);
  const medical = MEDICAL_RE.test(all) || conditions.length > 0 || Boolean(responses.medications?.trim());
  if (pregnancy) {
    safetyFlags.push("Pregnancy/breastfeeding mentioned: no calorie deficit, no raw/undercooked meat, fish or eggs, no high-mercury fish, no alcohol.");
    safetyNotes.push("Pregnancy and breastfeeding change nutrient needs — please confirm this plan with your doctor, midwife or a registered dietitian.");
  }
  if (ed) {
    safetyFlags.push("Eating-disorder history/risk mentioned: no deficits, no weighing emphasis, no restrictive language; regular meals.");
    safetyNotes.push("Because you mentioned eating-disorder concerns, this plan avoids restriction. A doctor or registered dietitian who works with eating disorders is the right partner for anything more specific.");
  }
  if (medical && !pregnancy && !ed) {
    safetyFlags.push(`Medical context present (${[...conditions, responses.medications?.trim() ? "medications" : ""].filter(Boolean).join(", ") || "mentioned in chat"}): general guidance only, no treatment claims.`);
    safetyNotes.push("With a medical condition or medication in the picture, check this plan with your doctor or a registered dietitian — it's general guidance, not medical nutrition therapy.");
  }
  if (EXTREME_RE.test(all)) {
    safetyFlags.push("Client asked for an extreme approach: do NOT prescribe it; keep calories at or above the safe minimum.");
    safetyNotes.push("I won't program cleanses, fasts or very-low-calorie days — this plan keeps enough food to train and recover. A doctor can supervise anything more aggressive.");
  }

  const { targets, source } = resolveTargets(profile, texts, sex, weightKg, goal, pregnancy || ed, safetyNotes);
  const requestedFoodIds = requestedFoodsFromTexts(texts);
  const allowedProcessedIds = new Set(
    [...requestedFoodIds].filter((id) => FOOD_CATALOG.find((f) => f.id === id)?.processing === "highly_processed")
  );

  const style: NutritionStyle = { complexity, quick, budget, ...(lowCarb ? { lowCarb } : {}) };
  const menuCount = explicitMenus ?? DEFAULT_MENU_COUNT[complexity];
  const region = resolveFoodRegion(texts, profile.preferred_locale);
  const summaryLines = [
    `Meals: ${slots.length} per day → slots ${slots.join(", ")}${skipBreakfast ? " (client skips breakfast)" : ""}${noSnacks ? " (no snacks)" : ""}.`,
    `Complexity: ${complexity.replace("_", " ")}${quick ? " + quick prep" : ""}${budget ? " + budget-friendly" : ""}.`,
    menuCount > 1
      ? `Menus: you write Day A; code derives ${menuCount - 1} more daily menus by rotating proteins, carbs and vegetables, so pick foods that are easy to swap.`
      : "Menus: one daily menu repeated (client wants it simple).",
    `Daily targets (${source}): ${targets.calories} kcal, protein ${targets.protein} g, carbs ${targets.carbs} g, fat ${targets.fat} g.`,
    responses.training_days_per_week ? `Training: ${responses.training_days_per_week.replace("_", "–")} days/week${responses.training_time_preference ? `, usually ${responses.training_time_preference}` : ""}.` : "",
    responses.cooking_frequency ? `Cooking habit: ${responses.cooking_frequency}.` : "",
    responses.work_hours ? `Work: ${responses.work_hours.replace("_", " ")}${responses.job_type ? `, ${responses.job_type} job` : ""}.` : "",
    responses.wake_time || responses.bedtime ? `Day: wakes ${responses.wake_time ?? "?"}, sleeps ${responses.bedtime ?? "?"}.` : "",
    `Shopping: ${REGION_LABEL[region]} — use foods found in a normal local supermarket there.`,
    allowedProcessedIds.size ? `Client explicitly asked for: ${[...allowedProcessedIds].map((id) => FOOD_CATALOG.find((f) => f.id === id)?.name ?? id).join(", ")} (allowed).` : "",
  ].filter(Boolean);

  return {
    goal,
    sex,
    age: responses.age ?? profile.age ?? null,
    weightKg,
    heightCm: responses.height_cm ?? profile.height_cm ?? null,
    trainingDays: responses.training_days_per_week ?? null,
    trainingTime: responses.training_time_preference ?? null,
    cooking: responses.cooking_frequency ?? null,
    mealsPerDay: slots.length,
    slots,
    style,
    menuCount,
    targets,
    targetSource: source,
    requestedFoodIds,
    allowedProcessedIds,
    safetyNotes,
    safetyFlags,
    locale: profile.preferred_locale ?? null,
    lang: profile.preferred_locale === "al" ? "al" : "en",
    region,
    summaryLines,
  };
}

/** Max real ingredients per meal (seasonings not counted) by complexity. */
export function maxIngredientsFor(style: NutritionStyle): number {
  switch (style.complexity) {
    case "very_simple":
      return 3;
    case "simple":
    case "meal_prep":
      return 4;
    case "variety":
      return 5;
    case "recipes":
      return 7;
  }
}
