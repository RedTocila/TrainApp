/**
 * Deterministic guard against the model picking a tool that contradicts what
 * the client literally asked (remove ≠ replace, question ≠ change). Pure.
 */

import type { CoachIntent } from "@/lib/ai/coach-intent";

export const WORKOUT_MUTATION_TOOLS = new Set([
  "generate_workout_plan",
  "edit_workout_plan",
  "remove_workout_exercise",
  "add_workout_exercise",
  "replace_workout_exercise",
  "adjust_workout_difficulty",
  "remove_workout_day",
  "remove_matching_exercises",
  "adapt_workout_to_constraints",
]);

/** Surgical nutrition edits that need an existing plan. */
export const NUTRITION_EDIT_TOOLS = new Set(["edit_nutrition_plan", "swap_food", "change_food_portion"]);

export const NUTRITION_MUTATION_TOOLS = new Set(["generate_nutrition_plan", ...NUTRITION_EDIT_TOOLS]);

/** Returns a tool-result message when blocked, null when the tool may run. */
export function guardToolForIntent(
  name: string,
  intent: CoachIntent | null,
  hasWorkingPlan: boolean
): string | null {
  if (!intent) return null;
  if (NUTRITION_MUTATION_TOOLS.has(name)) {
    if (intent.primary === "information" || intent.primary === "alternatives") {
      return "Blocked: the client asked a nutrition question. Answer it directly and practically (explain the why in 1–3 sentences, offer a concrete option). Don't build or change the meal plan unless they ask for it.";
    }
    if (intent.primary === "modify_nutrition" && hasWorkingPlan && name === "generate_nutrition_plan") {
      return "Blocked: the client wants to change their current meal plan, not get a new one. Use swap_food (one food), change_food_portion (one amount) or edit_nutrition_plan (broader change).";
    }
    return null;
  }
  if (
    (intent.primary === "information" || intent.primary === "alternatives") &&
    WORKOUT_MUTATION_TOOLS.has(name)
  ) {
    return intent.primary === "alternatives"
      ? "Blocked: the client asked for alternatives/options, not a change. List 2–4 suitable alternatives (respecting their equipment, injuries and exclusions) and ask if they want one swapped in. Do NOT change the plan."
      : "Blocked: the client asked a question. Answer it directly; don't build or change a plan unless they ask.";
  }
  if (
    intent.primary === "remove_day" &&
    hasWorkingPlan &&
    (name === "generate_workout_plan" || name === "edit_workout_plan")
  ) {
    return "Blocked: the client asked to REMOVE a day from the existing plan. Call remove_workout_day (focus or day_number). Do not regenerate the plan and do not add a replacement day.";
  }
  if (intent.removeOnly && name === "replace_workout_exercise") {
    return "Blocked: the client asked to REMOVE, not replace. Call remove_workout_exercise (one exercise) or remove_matching_exercises (e.g. all squats / everything for a muscle). Do not add substitutes unless they ask.";
  }
  if (
    intent.removeOnly &&
    intent.primary === "remove_exercise" &&
    name === "edit_workout_plan" &&
    hasWorkingPlan
  ) {
    return "Blocked: removing exercises is a surgical edit. Call remove_matching_exercises or remove_workout_exercise instead of regenerating.";
  }
  return null;
}
