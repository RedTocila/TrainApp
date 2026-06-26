const REFERRAL_STORAGE_KEY = "rutina_referral_code";
const DEVICE_HASH_KEY = "rutina_device_hash";

export function saveReferralCode(code: string): void {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return;
  try {
    sessionStorage.setItem(REFERRAL_STORAGE_KEY, normalized);
    localStorage.setItem(REFERRAL_STORAGE_KEY, normalized);
  } catch {
    // ignore storage errors
  }
}

export function loadReferralCode(): string | null {
  try {
    return (
      sessionStorage.getItem(REFERRAL_STORAGE_KEY) ??
      localStorage.getItem(REFERRAL_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function clearReferralCode(): void {
  try {
    sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function getOrCreateDeviceHash(): string {
  try {
    const existing = localStorage.getItem(DEVICE_HASH_KEY);
    if (existing) return existing;
    const created =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_HASH_KEY, created);
    return created;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
