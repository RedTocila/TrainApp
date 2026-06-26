import type { CoachCopy } from "@/lib/coach-copy";
import type { MealFormData } from "@/lib/meal-utils";

export type MealAdviceTier = "good" | "ok" | "bad";

export function getMealAdviceTier(score: number): MealAdviceTier {
  if (score >= 70) return "good";
  if (score >= 55) return "ok";
  return "bad";
}

export function getMealScoreTierStyles(tier: MealAdviceTier) {
  switch (tier) {
    case "good":
      return {
        card: "border-emerald-500/45 bg-emerald-500/15",
        coachCard:
          "border-emerald-500/55 bg-emerald-500/25 shadow-[0_0_28px_rgba(16,185,129,0.18)]",
        accent: "text-emerald-700 dark:text-emerald-300",
        quote: "text-emerald-950/85 dark:text-emerald-50/90",
        gauge: "text-emerald-400",
        bullet: "bg-emerald-400",
      };
    case "ok":
      return {
        card: "border-amber-500/45 bg-amber-500/15",
        coachCard:
          "border-amber-500/55 bg-amber-500/25 shadow-[0_0_28px_rgba(245,158,11,0.18)]",
        accent: "text-amber-800 dark:text-amber-300",
        quote: "text-amber-950/85 dark:text-amber-50/90",
        gauge: "text-amber-400",
        bullet: "bg-amber-400",
      };
    case "bad":
      return {
        card: "border-red-500/45 bg-red-500/15",
        coachCard:
          "border-red-500/55 bg-red-500/25 shadow-[0_0_28px_rgba(239,68,68,0.18)]",
        accent: "text-red-700 dark:text-red-300",
        quote: "text-red-950/85 dark:text-red-50/90",
        gauge: "text-red-400",
        bullet: "bg-red-400",
      };
  }
}

const PROTEIN_KEYWORDS = [
  "egg",
  "chicken",
  "beef",
  "fish",
  "tuna",
  "salmon",
  "prosciutto",
  "ham",
  "cheese",
  "yogurt",
  "turkey",
  "shrimp",
  "steak",
  "pork",
  "tofu",
  "lentil",
  "bean",
  "protein",
  "veze",
  "mish",
  "pule",
  "peshk",
  "djath",
  "kos",
];

function stablePick(seed: string, length: number): number {
  if (length <= 1) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

function fillTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(vars[key] ?? "")
  );
}

function reasonIncludes(reasons: string[], ...needles: string[]) {
  const joined = reasons.join(" ").toLowerCase();
  return needles.some((needle) => joined.includes(needle.toLowerCase()));
}

function findProteinHighlight(meal: MealFormData): string {
  for (const ingredient of meal.ingredients) {
    const lower = ingredient.name.toLowerCase();
    if (PROTEIN_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      return ingredient.name;
    }
  }

  const lowerName = meal.name.toLowerCase();
  for (const keyword of PROTEIN_KEYWORDS) {
    if (lowerName.includes(keyword)) {
      return meal.name;
    }
  }

  return meal.meal_type;
}

function pickAdvice(
  templates: readonly string[],
  seed: string,
  vars: Record<string, string | number>
): string {
  const template = templates[stablePick(seed, templates.length)] ?? templates[0];
  return fillTemplate(template, vars);
}

function buildAdviceSeed(
  meal: MealFormData,
  reasons: string[],
  score: number,
  variationKey?: string | number
) {
  return [
    meal.name,
    meal.meal_type,
    meal.macros.calories,
    meal.macros.protein,
    meal.macros.carbs,
    meal.macros.fat,
    score,
    ...reasons,
    ...meal.ingredients.slice(0, 4).map((i) => i.name),
    variationKey ?? "",
  ].join("|");
}

export function getCoachMealAdvice({
  copy,
  score,
  meal,
  reasons,
  goal,
  variationKey,
}: {
  copy: CoachCopy;
  score: number;
  meal: MealFormData;
  reasons: string[];
  goal?: string | null;
  variationKey?: string | number;
}): string {
  const insights = copy.mealInsights;
  const vars = {
    name: meal.name,
    protein: Math.round(meal.macros.protein),
    calories: Math.round(meal.macros.calories),
    carbs: Math.round(meal.macros.carbs),
    fat: Math.round(meal.macros.fat),
    highlight: findProteinHighlight(meal),
    mealType: meal.meal_type,
  };
  const seed = buildAdviceSeed(meal, reasons, score, variationKey);

  const hasLowProtein = reasonIncludes(
    reasons,
    "protein is low",
    "proteinat"
  );
  const hasStrongProtein = reasonIncludes(
    reasons,
    "strong protein",
    "proteinë e fortë",
    "protein i fortë"
  );
  const hasHighCalories = reasonIncludes(
    reasons,
    "calories are high",
    "kaloritë"
  );
  const hasReasonableCalories = reasonIncludes(
    reasons,
    "reasonable range",
    "në rregull"
  );
  const hasLowCarbs = reasonIncludes(
    reasons,
    "carbs may be low",
    "karbohidratet"
  );

  if (hasHighCalories) {
    return pickAdvice(insights.highCalories, `${seed}|high-cal`, vars);
  }

  if (hasStrongProtein) {
    return pickAdvice(insights.strongProtein, `${seed}|strong-protein`, vars);
  }

  if (hasLowProtein) {
    if (hasReasonableCalories) {
      return pickAdvice(
        insights.lowProteinReasonableCal,
        `${seed}|low-protein-ok-cal`,
        vars
      );
    }
    if (goal === "build_muscle") {
      return pickAdvice(
        insights.lowProteinBuildMuscle,
        `${seed}|low-protein-muscle`,
        vars
      );
    }
    if (goal === "lose_weight") {
      return pickAdvice(
        insights.lowProteinLoseWeight,
        `${seed}|low-protein-cut`,
        vars
      );
    }
    return pickAdvice(insights.lowProtein, `${seed}|low-protein`, vars);
  }

  if (hasLowCarbs) {
    return pickAdvice(insights.lowCarbsEndurance, `${seed}|low-carbs`, vars);
  }

  const tier = getMealAdviceTier(score);
  const pool =
    tier === "good" ? insights.good : tier === "ok" ? insights.ok : insights.bad;
  return pickAdvice(pool, `${seed}|tier-${tier}`, vars);
}
