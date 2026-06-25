import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { coachCopyAl, coachLabelsAl } from "@/lib/coach-copy-al";
import { coachCopyEn, coachLabelsEn } from "@/lib/coach-copy-en";

export type CoachCopy = typeof coachCopyEn | typeof coachCopyAl;
export type CoachLabels = typeof coachLabelsEn | typeof coachLabelsAl;

export function getCoachCopy(locale: CheckoutLocale): CoachCopy {
  return locale === "en" ? coachCopyEn : coachCopyAl;
}

export function getCoachLabels(locale: CheckoutLocale): CoachLabels {
  return locale === "en" ? coachLabelsEn : coachLabelsAl;
}

/** @deprecated Use getCoachCopy(locale) or useCoachCopy() */
export const coachCopy = coachCopyEn;

/** @deprecated Use getCoachLabels(locale) or useCoachLabels() */
export const coachLabels = coachLabelsEn;
