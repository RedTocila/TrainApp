import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject } from "@/lib/ai/parse-json";
import type { MacroTargets } from "@/lib/macro-calculator";
import { clampTargets } from "@/lib/macro-calculator";
import { buildDetailedIntakeContextForAi } from "@/lib/intake-questionnaire";
import { buildRationaleLanguageRule } from "@/lib/ai/language-instructions";
import { nutritionGoalRulesForAi } from "@/lib/goal-coaching";
import type { IntakeResponses } from "@/lib/intake-questionnaire";

export interface RefinedMacroResult {
  targets: MacroTargets;
  rationale: string;
}

function roundMacro(n: unknown): number {
  const v = typeof n === "number" ? n : parseFloat(String(n));
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}

function macroCaloriesMatch(targets: MacroTargets): boolean {
  const computed =
    targets.protein * 4 + targets.carbs * 4 + targets.fat * 9;
  return Math.abs(computed - targets.calories) / targets.calories <= 0.12;
}

function boundsForAi(
  baseline: MacroTargets,
  goal: string
): { minCal: number; maxCal: number } {
  const cal = baseline.calories;
  if (goal === "lose_weight") {
    return { minCal: Math.max(1200, Math.round(cal * 0.72)), maxCal: Math.round(cal * 0.98) };
  }
  if (goal === "gain_weight") {
    return { minCal: Math.round(cal * 0.98), maxCal: Math.round(cal * 1.22) };
  }
  if (goal === "build_muscle") {
    return { minCal: Math.round(cal * 0.95), maxCal: Math.round(cal * 1.12) };
  }
  return { minCal: Math.round(cal * 0.88), maxCal: Math.round(cal * 1.05) };
}

function normalizeAiMacros(
  raw: Record<string, unknown>,
  baseline: MacroTargets,
  goal: string
): RefinedMacroResult | null {
  const calories = roundMacro(raw.calories);
  const protein = roundMacro(raw.protein);
  const carbs = roundMacro(raw.carbs);
  const fat = roundMacro(raw.fat);
  const rationale =
    typeof raw.rationale === "string" && raw.rationale.trim()
      ? raw.rationale.trim()
      : "Personalized from your health profile.";

  if (calories < 500 || protein < 0) return null;

  const { minCal, maxCal } = boundsForAi(baseline, goal);
  const clampedCal = Math.min(maxCal, Math.max(minCal, calories));

  let targets = clampTargets({ calories: clampedCal, protein, carbs, fat });

  if (!macroCaloriesMatch(targets)) {
    const fatCal = Math.round(clampedCal * 0.28);
    const proteinCal = Math.min(protein * 4, Math.round(clampedCal * 0.35));
    const carbCal = Math.max(0, clampedCal - proteinCal - fatCal);
    targets = clampTargets({
      calories: clampedCal,
      protein: Math.round(proteinCal / 4),
      carbs: Math.round(carbCal / 4),
      fat: Math.round(fatCal / 9),
    });
  }

  return { targets, rationale };
}

export async function refineMacrosWithAi(
  responses: IntakeResponses,
  baseline: MacroTargets,
  preferredLocale?: string | null
): Promise<RefinedMacroResult | null> {
  const context = buildDetailedIntakeContextForAi(responses);
  const goal = responses.goal ?? "stay_fit";

  const prompt = `You are an expert sports nutritionist. A generic formula estimated daily macros for this client.

CLIENT HEALTH PROFILE:
${context}

FORMULA BASELINE:
- Calories: ${baseline.calories}
- Protein: ${baseline.protein}g
- Carbs: ${baseline.carbs}g
- Fat: ${baseline.fat}g

${nutritionGoalRulesForAi(goal)}

Instructions:
- Estimate realistic maintenance calories from age, sex, weight, height, job type, daily steps, and training frequency — do NOT double-count gym days as both high activity AND a large training bump.
- Then apply a goal-appropriate adjustment. Match the stated goal — never default to a cut.
- For lose_weight: usually BELOW the formula baseline (deficit).
- For gain_weight: ABOVE the formula baseline (surplus). Slim / hardgainer clients need extra calories they can actually eat. Do not lower calories "to be conservative."
- For build_muscle: small surplus only when training is adequate.
- For stay_fit / general_health / improve_endurance: near maintenance.
- Respect injuries, medical conditions, sleep, stress, diet style, and timeline.
- Protein: typically 1.6–2.2 g/kg for muscle, fat loss, or weight gain; lower for general health.
- Macros must approximately match calories (protein×4 + carbs×4 + fat×9).

${buildRationaleLanguageRule(preferredLocale)}

Respond with ONLY valid JSON:
{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "rationale": "One short sentence explaining the adjustment in plain language"
}`;

  try {
    const raw = await runTextPrompt(prompt, { maxTokens: 600, json: true });
    const parsed = parseJsonObject(raw) as Record<string, unknown>;
    return normalizeAiMacros(parsed, baseline, goal);
  } catch {
    return null;
  }
}
