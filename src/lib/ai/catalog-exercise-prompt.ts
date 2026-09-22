import type { EquipmentConstraint } from "@/lib/ai/equipment-taxonomy";
import {
  buildCandidatePoolPromptBlock,
  type WorkoutCandidatePool,
} from "@/lib/ai/workout-candidate-pool";

/**
 * Soft + hard catalog naming rules for AI prompts.
 * When a candidate pool is provided, the model MUST pick from that filtered list.
 */
export function buildCatalogExerciseNameRule(
  equipment?: EquipmentConstraint | null,
  candidatePool?: WorkoutCandidatePool | null
): string {
  if (candidatePool && candidatePool.candidates.length > 0) {
    return buildCandidatePoolPromptBlock(candidatePool);
  }

  // Fallback when called without a pool (legacy / non-workout paths).
  const equipmentHint = equipment?.promptRule
    ? `\n- Equipment: ${equipment.promptRule}`
    : "";
  return `- CRITICAL: Every "name" MUST be copied EXACTLY from the app exercise library. Do NOT invent names.${equipmentHint}`;
}
