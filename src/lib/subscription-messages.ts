import type { CheckoutLocale } from "@/lib/checkout-i18n";

export const SUBSCRIPTION_REQUIRED_MESSAGE_EN =
  "Create a free account to use RUTINA. Plus is €7/month and Pro is €25/month.";

export const SUBSCRIPTION_REQUIRED_MESSAGE_AL =
  "Krijo një llogari falas për të përdorur RUTINA. Plus është 7€/muaj dhe Pro 25€/muaj.";

export const PLUS_REQUIRED_MESSAGE_EN =
  "Plus (€7/month) includes the AI workout builder, nutrition plans, multiple programs, weekly reports, and advanced statistics.";

export const PLUS_REQUIRED_MESSAGE_AL =
  "Plus (7€/muaj) përfshin ndërtuesin e stërvitjeve me AI, planet e ushqimit, disa programe, raportet javore dhe statistikat e avancuara.";

export const PRO_REQUIRED_MESSAGE_EN =
  "Pro (€25/month) includes AI Coach conversations, plan adjustments, detailed insights, and premium challenges or live classes.";

export const PRO_REQUIRED_MESSAGE_AL =
  "Pro (25€/muaj) përfshin bisedat me AI Coach, përshtatjet e planit, analizat e detajuara dhe sfidat ose klasat live.";

export const LIMIT_EXCEEDED_MESSAGE_EN = PRO_REQUIRED_MESSAGE_EN;

export const LIMIT_EXCEEDED_MESSAGE_AL = PRO_REQUIRED_MESSAGE_AL;

/** @deprecated Use getSubscriptionRequiredMessage(locale) */
export const SUBSCRIPTION_REQUIRED_MESSAGE = SUBSCRIPTION_REQUIRED_MESSAGE_AL;

export function getSubscriptionRequiredMessage(locale: CheckoutLocale = "al"): string {
  return locale === "en" ? SUBSCRIPTION_REQUIRED_MESSAGE_EN : SUBSCRIPTION_REQUIRED_MESSAGE_AL;
}

export function getPlusRequiredMessage(locale: CheckoutLocale = "al"): string {
  return locale === "en" ? PLUS_REQUIRED_MESSAGE_EN : PLUS_REQUIRED_MESSAGE_AL;
}

export function getProRequiredMessage(locale: CheckoutLocale = "al"): string {
  return locale === "en" ? PRO_REQUIRED_MESSAGE_EN : PRO_REQUIRED_MESSAGE_AL;
}

export function getLimitExceededMessage(locale: CheckoutLocale = "al"): string {
  return getProRequiredMessage(locale);
}
