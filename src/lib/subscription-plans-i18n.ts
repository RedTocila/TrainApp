import type { CheckoutCurrency, CheckoutLocale } from "@/lib/checkout-i18n";
import { formatCurrencyAmount, toCurrencyCents } from "@/lib/checkout-i18n";
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
  monthlyEurCents: number,
  annualEurCents: number,
  currency: CheckoutCurrency,
  allPerEur: number,
  locale: CheckoutLocale
): string | null {
  const savedEurCents = monthlyEurCents * 12 - annualEurCents;
  if (savedEurCents <= 0) return null;
  const savedCents = toCurrencyCents(savedEurCents, currency, allPerEur);
  const amount = formatCurrencyAmount(savedCents, currency);
  return getPlatformCopy(locale).pricing.savePerYear(amount);
}
