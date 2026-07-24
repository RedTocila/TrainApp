import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";

/** Invitee first-subscription discount (€5). */
export const INVITEE_DISCOUNT_CENTS = 500;

/** Inviter credit when invitee pays for a subscription (€10). */
export const INVITER_CREDIT_CENTS = 1000;

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function formatReferralCreditEuros(
  cents: number,
  locale: CheckoutLocale = "en"
): string {
  const value = cents / 100;
  return new Intl.NumberFormat(locale === "al" ? "sq-AL" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function referralShareUrl(code: string, baseUrl: string): string {
  const url = new URL("/register", baseUrl);
  url.searchParams.set("ref", code);
  return url.toString();
}

export function referralEarnDescription(locale: CheckoutLocale): string {
  return getPlatformCopy(locale).referral.earnTx;
}

export function referralSpendDescription(locale: CheckoutLocale): string {
  return getPlatformCopy(locale).referral.spendTx;
}
