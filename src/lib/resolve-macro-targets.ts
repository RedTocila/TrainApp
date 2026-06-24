import {
  calculateMacrosFromIntakeResponses,
  calculateMacrosFromProfile,
  type MacroTargets,
} from "@/lib/macro-calculator";
import { refineMacrosWithAi } from "@/lib/ai/refine-macros";
import { isIntakeResponsesComplete, type IntakeResponses } from "@/lib/intake-questionnaire";
import type { Profile } from "@/lib/types";

export type MacroTargetSource = "ai" | "formula";

export interface ResolvedMacroTargets {
  targets: MacroTargets;
  source: MacroTargetSource;
  rationale?: string;
}

export async function resolveMacroTargets(
  profile: Profile,
  responses?: IntakeResponses
): Promise<ResolvedMacroTargets | null> {
  const intake = responses ?? profile.intake_responses;
  const mergedProfile = responses
    ? ({ ...profile, ...responses, intake_responses: responses } as Profile)
    : profile;

  const baseline =
    intake && isIntakeResponsesComplete(intake)
      ? calculateMacrosFromIntakeResponses(intake)
      : calculateMacrosFromProfile(mergedProfile);

  if (!baseline) return null;

  if (intake && isIntakeResponsesComplete(intake)) {
    const refined = await refineMacrosWithAi(intake, baseline);
    if (refined) {
      return {
        targets: refined.targets,
        source: "ai",
        rationale: refined.rationale,
      };
    }
  }

  return { targets: baseline, source: "formula" };
}
