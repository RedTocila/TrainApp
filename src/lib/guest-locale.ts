import type { CheckoutLocale } from "@/lib/checkout-i18n";

export const LOCALE_COOKIE_NAME = "rutina_locale";
export const LOCALE_STORAGE_KEY = "rutina_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Client-side: persist locale for guests (cookie + localStorage). */
export function persistGuestLocale(locale: CheckoutLocale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;max-age=${LOCALE_COOKIE_MAX_AGE};samesite=lax`;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
  document.documentElement.lang = locale === "en" ? "en" : "sq";
}

export function readStoredGuestLocale(): CheckoutLocale | null {
  if (typeof window === "undefined") return null;
  try {
    const fromStorage = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (fromStorage === "en" || fromStorage === "al") return fromStorage;
  } catch {
    // ignore
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]*)`));
  if (match?.[1] === "en" || match?.[1] === "al") return match[1];
  return null;
}
