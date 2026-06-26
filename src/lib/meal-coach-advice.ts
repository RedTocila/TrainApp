import type { CoachCopy } from "@/lib/coach-copy";

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

function stablePick(seed: string, length: number): number {
  if (length <= 1) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % length;
  }
  return hash;
}

export function getCoachMealAdvice({
  copy,
  score,
  mealName,
  reasons,
  goal,
}: {
  copy: CoachCopy;
  score: number;
  mealName: string;
  reasons: string[];
  goal?: string | null;
}): string {
  const insights = copy.mealInsights;
  const joined = reasons.join(" ").toLowerCase();

  if (joined.includes("protein is low") || joined.includes("proteinat")) {
    if (goal === "build_muscle") return insights.lowProteinBuildMuscle;
    if (goal === "lose_weight") return insights.lowProteinLoseWeight;
    return insights.lowProtein;
  }

  if (joined.includes("calories are high") || joined.includes("kaloritë")) {
    return insights.highCalories;
  }

  if (joined.includes("carbs may be low") || joined.includes("karbohidratet")) {
    return insights.lowCarbsEndurance;
  }

  const tier = getMealAdviceTier(score);
  const pool = insights[tier];
  return pool[stablePick(mealName.toLowerCase(), pool.length)] ?? pool[0];
}
