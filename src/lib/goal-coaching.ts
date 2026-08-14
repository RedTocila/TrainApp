/** Shared goal keys used in profile settings, intake, and macros. */
export const PROFILE_GOAL_KEYS = [
  "lose_weight",
  "gain_weight",
  "build_muscle",
  "stay_fit",
  "improve_endurance",
  "general_health",
] as const;

export type ProfileGoalKey = (typeof PROFILE_GOAL_KEYS)[number];

export function isCalorieSurplusGoal(goal?: string | null): boolean {
  return goal === "gain_weight" || goal === "build_muscle";
}

/** Diet rules injected into nutrition / macro AI prompts. */
export function nutritionGoalRulesForAi(goal?: string | null): string {
  switch (goal) {
    case "gain_weight":
      return `GOAL = gain_weight (healthy weight gain for slim / hardgainer clients):
- Calorie SURPLUS is mandatory — never a deficit, cut, or "eat less".
- Best diet: calorie-dense whole foods that are easy to eat — rice, pasta, oats, potatoes, bread, olive oil, nut butters, full-fat dairy, eggs, meats, smoothies, extra snacks between meals.
- 4–6 eating occasions per day. Do not prescribe tiny "clean" portions that keep them skinny.
- Protein ~1.8–2.2 g/kg so surplus calories support muscle, not only fat.
- Carbs are the main surplus driver; fats moderate-high so calories are realistic to hit.
- If they struggle to finish meals, prefer liquids/smoothies, extra oil/nut butter, and bigger carb sides — not more salad.`;
    case "lose_weight":
      return `GOAL = lose_weight:
- Moderate calorie deficit, high protein, muscle retention.
- Sustainable portions — no crash diets or extreme restriction.`;
    case "build_muscle":
      return `GOAL = build_muscle:
- Small surplus (or recomp if they already carry extra fat). High protein.
- Fuel training; do not default to a fat-loss cut.`;
    case "improve_endurance":
      return `GOAL = improve_endurance:
- Near-maintenance calories with enough carbs to fuel training.`;
    case "stay_fit":
    case "general_health":
      return `GOAL = ${goal}:
- Maintenance calories, balanced macros, sustainable habits. Do not default to fat loss.`;
    default:
      return `Match calories to the stated goal. Do not default to a fat-loss cut.`;
  }
}

/** Training rules injected into workout AI prompts. */
export function trainingGoalRulesForAi(goal?: string | null): string {
  switch (goal) {
    case "gain_weight":
      return `GOAL = gain_weight: hypertrophy-first (compound lifts, 6–12 reps, progressive overload). Keep extra cardio modest so it does not burn the surplus.`;
    case "build_muscle":
      return `GOAL = build_muscle: hypertrophy and progressive overload; keep conditioning secondary.`;
    case "lose_weight":
      return `GOAL = lose_weight: retain muscle with strength work; some conditioning is fine.`;
    case "improve_endurance":
      return `GOAL = improve_endurance: aerobic base plus supporting strength.`;
    default:
      return `Match training to the stated goal. Do not assume they want fat loss.`;
  }
}
