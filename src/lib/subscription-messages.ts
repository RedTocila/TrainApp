import type { CheckoutLocale } from "@/lib/checkout-i18n";

export const SUBSCRIPTION_REQUIRED_MESSAGE_EN =
  "Subscribe to add workouts, meals, habits, and more — starting from €5.";

export const SUBSCRIPTION_REQUIRED_MESSAGE_AL =
  "Abonohu për të shtuar stërvitje, vakte, zakone dhe më shumë — duke filluar nga 5€.";

export const LIMIT_EXCEEDED_MESSAGE_EN =
  "You have exceeded your limit, pick a plan to continue.";

export const LIMIT_EXCEEDED_MESSAGE_AL =
  "Ke tejkaluar limitin, zgjidh një plan për të vazhduar.";

/** @deprecated Use getSubscriptionRequiredMessage(locale) */
export const SUBSCRIPTION_REQUIRED_MESSAGE = SUBSCRIPTION_REQUIRED_MESSAGE_AL;

export function getSubscriptionRequiredMessage(locale: CheckoutLocale = "al"): string {
  return locale === "en" ? SUBSCRIPTION_REQUIRED_MESSAGE_EN : SUBSCRIPTION_REQUIRED_MESSAGE_AL;
}

export function getLimitExceededMessage(locale: CheckoutLocale = "al"): string {
  return locale === "en" ? LIMIT_EXCEEDED_MESSAGE_EN : LIMIT_EXCEEDED_MESSAGE_AL;
}
