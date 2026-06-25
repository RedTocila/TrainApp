import { PLATFORM_CORE_NAME } from "@/lib/brand";
import type { CheckoutCurrency, CheckoutLocale } from "@/lib/checkout-i18n";
import {
  allCentsToCurrencyCents,
  formatCurrencyAmount,
} from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import type { SubscriptionPlan } from "@/lib/subscription-plans";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

export function getLocalizedSubscriptionPlans(
  locale: CheckoutLocale
): SubscriptionPlan[] {
  const copy = getPlatformCopy(locale);
  const plans = copy.subscriptionPlans;

  return SUBSCRIPTION_PLANS.map((plan) => {
    if (plan.id === "core") {
      return {
        ...plan,
        tagline: plans.coreTagline,
        features: [...plans.coreFeatures],
      };
    }
    return {
      ...plan,
      tagline: plans.aiTagline,
      badge: plans.bestValue,
      features: plans.aiFeatures(PLATFORM_CORE_NAME),
    };
  });
}

export function formatAnnualSavingsLocalized(
  monthlyAllCents: number,
  annualAllCents: number,
  currency: CheckoutCurrency,
  locale: CheckoutLocale
): string | null {
  const savedAll = monthlyAllCents * 12 - annualAllCents;
  if (savedAll <= 0) return null;
  const saved = allCentsToCurrencyCents(savedAll, currency);
  const amount = formatCurrencyAmount(saved, currency);
  return getPlatformCopy(locale).pricing.savePerYear(amount);
}
