"use client";

const REFERRAL_CODE_STORAGE_KEY = "rutina_checkout_referral_code";

/** Persist a referral code from share links until package checkout. */
export function saveCheckoutReferralCode(code: string) {
  if (typeof window === "undefined") return;
  const normalized = code.trim();
  if (!normalized) return;
  sessionStorage.setItem(REFERRAL_CODE_STORAGE_KEY, normalized);
}

export function loadCheckoutReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REFERRAL_CODE_STORAGE_KEY);
}

export function clearCheckoutReferralCode() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
}
