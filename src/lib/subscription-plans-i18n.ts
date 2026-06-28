import type { CheckoutLocale, PriceInEur } from "@/lib/checkout-i18n";
import { formatCurrencyAmount } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import type { SubscriptionPlan } from "@/lib/subscription-plans";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

export function getLocalizedSubscriptionPlans(
  locale: CheckoutLocale
): SubscriptionPlan[] {
  const copy = getPlatformCopy(locale);
  const plans = copy.subscriptionPlans;

  return SUBSCRIPTION_PLANS.map((plan) => {
    const localized =
      plan.id === "basic"
        ? plans.basic
        : plan.id === "ai"
          ? plans.aiPro
          : plans.elite;

    return {
      ...plan,
      name: localized.name,
      tagline: localized.tagline,
      badge: "badge" in localized ? localized.badge : plan.badge,
      includesFrom:
        "includesFrom" in localized ? localized.includesFrom : plan.includesFrom,
      features: [...localized.features],
    };
  });
}

export function formatAnnualSavingsLocalized(
  monthly: PriceInEur,
  annual: PriceInEur,
  locale: CheckoutLocale
): string | null {
  const savedCents = monthly.amountEurCents * 12 - annual.amountEurCents;
  if (savedCents <= 0) return null;
  const amount = formatCurrencyAmount(savedCents);
  return getPlatformCopy(locale).pricing.savePerYear(amount);
}

export function getPricingCardLabels(locale: CheckoutLocale) {
  const pricing = getPlatformCopy(locale).pricing;
  return {
    perMonth: pricing.perMonth,
    perYear: pricing.perYear,
    currentPlan: pricing.currentPlan,
    switchPlan: pricing.switchPlan,
    subscribe: pricing.subscribe,
    includesFrom: pricing.includesFrom,
  };
}
