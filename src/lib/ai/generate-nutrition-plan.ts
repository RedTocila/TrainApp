import { runTextPrompt } from "@/lib/ai/providers";
import { parseJsonObject } from "@/lib/ai/parse-json";
import type { AiGeneratedNutritionPlan } from "@/lib/ai/plan-builder-types";
import type { Profile } from "@/lib/types";
import { parseSemanticDietaryItems, type SemanticDietaryItem } from "@/lib/ai/nutrition-constraints";
import {
  buildNutritionRequest,
  runNutritionPipeline,
  type NutritionGenerationInput,
} from "@/lib/ai/nutrition-pipeline";

export type { NutritionGenerationInput };

const FOODISH_RE =
  /\b(?:eat|drink|food|foods|meal|meals|diet|allerg\w*|intoleran\w*|milk|dairy|meat|fish|egg|eggs|gluten|nuts?|vegan|vegetarian|hate|dislike|stomach|bloat\w*|can't have|cannot have|don't like|avoid|without|no|keep|work for me|ushqim|ha|pi)\b/i;

/**
 * Semantic pass for wording the rule parser may miss ("milk doesn't sit well",
 * other languages). Output is normalized and merged by code: exclusions are
 * added (never as allergies); "allow" lifts a non-allergy rule only when the
 * newest message itself mentions that food without excluding it.
 */
export async function extractDietaryConstraintsSemantic(texts: readonly string[]): Promise<SemanticDietaryItem[]> {
  const relevant = texts.filter((t) => FOODISH_RE.test(t)).slice(-8);
  if (!relevant.length) return [];
  const prompt = `Extract the client's food exclusions from their messages (any language). Messages are chronological; a later message can cancel an earlier one ("actually I eat fish again").

MESSAGES:
${relevant.map((t, i) => `${i + 1}. "${t.slice(0, 500)}"`).join("\n")}

Return ONLY JSON: {"items":[{"food":"english food or food group","category":"dairy|chicken|poultry|fish|shellfish|seafood|eggs|gluten|soy|nuts|peanuts|red_meat|pork|meat|animal_products|null","severity":"allergy|intolerance|dislike|restriction","action":"exclude|allow"}]}
Rules:
- Only foods the client says they avoid, can't have, react to, dislike, or re-allow. Do not guess.
- severity "allergy" ONLY if they literally say allergic/allergy; "intolerance" for reactions/digestive issues/"doesn't work for me"; "dislike" for taste; otherwise "restriction".
- "No milk" / "I don't drink milk" → food "milk" (not all dairy) unless they say dairy.
- action "allow" only when the client clearly re-allows a food they excluded before ("fish is back on", "I'm eating eggs again", "tani e ha mishin").
- Empty list if nothing applies.`;
  try {
    const raw = await runTextPrompt(prompt, { maxTokens: 400, json: true, tier: "cheap" });
    return parseSemanticDietaryItems(parseJsonObject(raw));
  } catch {
    return [];
  }
}

export async function generateNutritionPlanFromProfile(
  profile: Profile,
  preferences?: string,
  input?: NutritionGenerationInput
): Promise<AiGeneratedNutritionPlan> {
  const request = buildNutritionRequest(profile, preferences, input);
  const result = await runNutritionPipeline(request, {
    generate: (prompt) => runTextPrompt(prompt, { maxTokens: 2400, json: true, tier: "quality" }),
    extractSemantic: extractDietaryConstraintsSemantic,
  });
  return result.plan;
}
