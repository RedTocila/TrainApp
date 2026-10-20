import type { CheckoutLocale } from "@/lib/checkout-i18n";

export const SUBSCRIPTION_REQUIRED_MESSAGE_EN =
  "Upgrade to Elite for Coach Alex and premium features — €29.99/month.";

export const SUBSCRIPTION_REQUIRED_MESSAGE_AL =
  "Përmirësohu në Elite për Coach Alex dhe funksione premium — 29.99€/muaj.";

export const LIMIT_EXCEEDED_MESSAGE_EN =
  "Upgrade to Elite to unlock this feature.";

export const LIMIT_EXCEEDED_MESSAGE_AL =
  "Përmirësohu në Elite për të hapur këtë funksion.";

/** @deprecated Use getSubscriptionRequiredMessage(locale) */
export const SUBSCRIPTION_REQUIRED_MESSAGE = SUBSCRIPTION_REQUIRED_MESSAGE_AL;

export function getSubscriptionRequiredMessage(locale: CheckoutLocale = "al"): string {
  return locale === "en" ? SUBSCRIPTION_REQUIRED_MESSAGE_EN : SUBSCRIPTION_REQUIRED_MESSAGE_AL;
}

export function getLimitExceededMessage(locale: CheckoutLocale = "al"): string {
  return locale === "en" ? LIMIT_EXCEEDED_MESSAGE_EN : LIMIT_EXCEEDED_MESSAGE_AL;
}
