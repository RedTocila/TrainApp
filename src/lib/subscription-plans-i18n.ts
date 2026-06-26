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
  const plan = SUBSCRIPTION_PLANS[0];

  return [
    {
      ...plan,
      tagline: plans.aiTagline,
      badge: plans.bestValue,
      features: [...plans.aiFeatures],
    },
  ];
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
