"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { AiFoodDemoIllustration } from "@/components/ai-food-demo-illustration";
import { CheckoutCurrencyToggle } from "@/components/checkout-preferences-toggle";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import type { BillingInterval } from "@/lib/subscription-plans";
import {
  formatAnnualSavingsLocalized,
  getLocalizedSubscriptionPlans,
} from "@/lib/subscription-plans-i18n";
import {
  DEFAULT_CHECKOUT_CURRENCY,
  getCurrencyPrice,
  type CheckoutCurrency,
} from "@/lib/checkout-i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const BILLING_INTERVALS = ["monthly", "annual"] as const;

export function PricingPlans({
  interval,
  onIntervalChange,
  checkoutBasePath = "/dashboard/checkout",
  currentPlan,
  subscribed,
}: {
  interval: BillingInterval;
  onIntervalChange: (interval: BillingInterval) => void;
  checkoutBasePath?: string;
  currentPlan?: string | null;
  subscribed?: boolean;
}) {
  const locale = useLocale();
  const platform = usePlatformCopy();
  const pricing = platform.pricing;
  const plans = getLocalizedSubscriptionPlans(locale);
  const [currency, setCurrency] = useState<CheckoutCurrency>(DEFAULT_CHECKOUT_CURRENCY);

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-3">
        <CheckoutCurrencyToggle currency={currency} onCurrencyChange={setCurrency} />
        <SegmentedToggle
          value={interval}
          onChange={onIntervalChange}
          aria-label="Billing interval"
          className="w-auto"
          options={BILLING_INTERVALS.map((key) => ({
            value: key,
            label: key === "monthly" ? pricing.monthly : pricing.annual,
          }))}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((plan) => {
          const tier = interval === "monthly" ? plan.monthly : plan.annual;
          const price = getCurrencyPrice(tier, currency);
          const savings =
            interval === "annual"
              ? formatAnnualSavingsLocalized(
                  plan.monthly.amountAllCents,
                  plan.annual.amountAllCents,
                  currency,
                  locale
                )
              : null;
          const isCurrent = subscribed && currentPlan === plan.id;

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative overflow-hidden",
                plan.highlighted && "border-primary/50 shadow-lg shadow-primary/10"
              )}
            >
              {plan.badge && (
                <div className="absolute right-4 top-4">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                    <Sparkles className="h-3 w-3" />
                    {plan.badge}
                  </span>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                <div className="pt-2">
                  <span className="text-4xl font-black">{price.label}</span>
                  <span className="text-muted-foreground">
                    /{interval === "monthly" ? pricing.perMonth : pricing.perYear}
                  </span>
                  {savings && (
                    <p className="mt-1 text-sm font-medium text-green-400">{savings}</p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {plan.id === "ai" && <AiFoodDemoIllustration />}
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button className="w-full" variant="outline" disabled>
                    {pricing.currentPlan}
                  </Button>
                ) : (
                  <Link
                    href={`${checkoutBasePath}?plan=${plan.id}&interval=${interval}&currency=${currency}`}
                  >
                    <Button className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                      {subscribed ? pricing.switchPlan : pricing.subscribe}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
