import type { CheckoutLocale } from "@/lib/checkout-i18n";

export const SUBSCRIPTION_REQUIRED_MESSAGE_EN =
  "Subscribe to add workouts, meals, habits, and more.";

export const SUBSCRIPTION_REQUIRED_MESSAGE_AL =
  "Abonohu për të shtuar stërvitje, vakte, zakone dhe më shumë.";

/** @deprecated Use getSubscriptionRequiredMessage(locale) */
export const SUBSCRIPTION_REQUIRED_MESSAGE = SUBSCRIPTION_REQUIRED_MESSAGE_AL;

export function getSubscriptionRequiredMessage(locale: CheckoutLocale = "al"): string {
  return locale === "en" ? SUBSCRIPTION_REQUIRED_MESSAGE_EN : SUBSCRIPTION_REQUIRED_MESSAGE_AL;
}
