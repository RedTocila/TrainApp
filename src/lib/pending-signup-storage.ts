"use client";

export const PENDING_SIGNUP_STORAGE_KEY = "rutina_pending_signup";

export type PendingSignupDraft = {
  fullName: string;
  email: string;
  phone: string | null;
  password: string;
  intakeJson: string | null;
  referralCode: string | null;
  acceptedTerms: true;
  savedAt: number;
};

export function savePendingSignupDraft(draft: Omit<PendingSignupDraft, "savedAt" | "acceptedTerms">) {
  if (typeof window === "undefined") return;
  const payload: PendingSignupDraft = {
    ...draft,
    email: draft.email.trim().toLowerCase(),
    acceptedTerms: true,
    savedAt: Date.now(),
  };
  sessionStorage.setItem(PENDING_SIGNUP_STORAGE_KEY, JSON.stringify(payload));
}

export function loadPendingSignupDraft(): PendingSignupDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_SIGNUP_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingSignupDraft;
    if (
      !parsed?.email ||
      !parsed?.password ||
      !parsed?.fullName ||
      parsed.acceptedTerms !== true
    ) {
      return null;
    }
    // Expire client draft after 24h.
    if (parsed.savedAt && Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      clearPendingSignupDraft();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSignupDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
}
