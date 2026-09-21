import type { Profile } from "@/lib/types";
import {
  getClientIntakeStatusFromProfile,
  getMissingIntakeResponses,
  isClientIntakeCompleteFromProfile,
  profileToResponses,
  type ClientIntakeStatus,
} from "@/lib/intake-questionnaire";

export type { ClientIntakeStatus };

/** Days after last questionnaire save before we nudge a refresh. */
export const INTAKE_REFRESH_AFTER_DAYS = 30;

export function getMissingIntakeFields(profile: Profile): string[] {
  return getMissingIntakeResponses(profileToResponses(profile));
}

export function isClientIntakeComplete(profile: Profile): boolean {
  return isClientIntakeCompleteFromProfile(profile);
}

export function getClientIntakeStatus(profile: Profile): ClientIntakeStatus {
  return getClientIntakeStatusFromProfile(profile);
}

/** ISO timestamp used as the "last updated" anchor for refresh nudges. */
export function getIntakeLastUpdatedAt(profile: Profile): string | null {
  return profile.intake_responses_updated_at ?? profile.created_at ?? null;
}

/** True when a complete profile hasn't refreshed health & lifestyle in ~a month. */
export function isIntakeRefreshDue(
  profile: Profile,
  now: Date = new Date()
): boolean {
  if (!isClientIntakeComplete(profile)) return false;
  const last = getIntakeLastUpdatedAt(profile);
  if (!last) return true;
  const lastMs = new Date(last).getTime();
  if (Number.isNaN(lastMs)) return true;
  const ageMs = now.getTime() - lastMs;
  return ageMs >= INTAKE_REFRESH_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

const DISMISS_STORAGE_PREFIX = "intake-refresh-dismissed:";

type IntakeRefreshDismiss = {
  dismissedAt: string;
  forUpdatedAt: string | null;
};

export function intakeRefreshDismissStorageKey(userId: string): string {
  return `${DISMISS_STORAGE_PREFIX}${userId}`;
}

export function readIntakeRefreshDismiss(
  userId: string
): IntakeRefreshDismiss | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      intakeRefreshDismissStorageKey(userId)
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntakeRefreshDismiss;
    if (!parsed?.dismissedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeIntakeRefreshDismiss(
  userId: string,
  forUpdatedAt: string | null
): void {
  if (typeof window === "undefined") return;
  const payload: IntakeRefreshDismiss = {
    dismissedAt: new Date().toISOString(),
    forUpdatedAt,
  };
  window.localStorage.setItem(
    intakeRefreshDismissStorageKey(userId),
    JSON.stringify(payload)
  );
}

export function clearIntakeRefreshDismiss(userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(intakeRefreshDismissStorageKey(userId));
}

/** Whether the monthly refresh banner should render (server staleness + client dismiss). */
export function shouldShowIntakeRefreshBanner(
  profile: Profile,
  now: Date = new Date()
): boolean {
  if (!isIntakeRefreshDue(profile, now)) return false;
  const last = getIntakeLastUpdatedAt(profile);
  const dismiss = readIntakeRefreshDismiss(profile.id);
  if (!dismiss) return true;
  // New questionnaire save since dismiss → don't show until due again.
  if (dismiss.forUpdatedAt !== last) return true;
  const dismissedMs = new Date(dismiss.dismissedAt).getTime();
  if (Number.isNaN(dismissedMs)) return true;
  // Reminder again a month after dismiss if still stale.
  return (
    now.getTime() - dismissedMs >=
    INTAKE_REFRESH_AFTER_DAYS * 24 * 60 * 60 * 1000
  );
}
