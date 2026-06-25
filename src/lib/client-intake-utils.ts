import type { Profile } from "@/lib/types";
import {
  getClientIntakeStatusFromProfile,
  getMissingIntakeResponses,
  isClientIntakeCompleteFromProfile,
  profileToResponses,
  type ClientIntakeStatus,
} from "@/lib/intake-questionnaire";

export type { ClientIntakeStatus };

export function getMissingIntakeFields(profile: Profile): string[] {
  return getMissingIntakeResponses(profileToResponses(profile));
}

export function isClientIntakeComplete(profile: Profile): boolean {
  return isClientIntakeCompleteFromProfile(profile);
}

export function getClientIntakeStatus(profile: Profile): ClientIntakeStatus {
  return getClientIntakeStatusFromProfile(profile);
}
