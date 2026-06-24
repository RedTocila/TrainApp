import type { Profile } from "@/lib/types";
import {
  getMissingIntakeResponses,
  isClientIntakeCompleteFromProfile,
  profileToResponses,
} from "@/lib/intake-questionnaire";

export function getMissingIntakeFields(profile: Profile): string[] {
  return getMissingIntakeResponses(profileToResponses(profile));
}

export function isClientIntakeComplete(profile: Profile): boolean {
  return isClientIntakeCompleteFromProfile(profile);
}
