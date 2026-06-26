"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { SegmentedToggle } from "@/components/segmented-toggle";
import {
  GET_STARTED_CTA,
  GET_STARTED_HREF,
} from "@/lib/landing-content";
import {
  SUBSCRIPTION_PLANS,
  type BillingInterval,
} from "@/lib/subscription-plans";
import {
  DEFAULT_CHECKOUT_CURRENCY,
  formatAnnualSavings,
  getCurrencyPrice,
} from "@/lib/checkout-i18n";
import { FadeIn } from "@/components/landing/landing-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function LandingPricing({ allPerEur }: { allPerEur: number }) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const currency = DEFAULT_CHECKOUT_CURRENCY;
  const eurMonthly = getCurrencyPrice(SUBSCRIPTION_PLANS[0].monthly, "EUR", allPerEur);

  return (
    <section id="pricing" className="landing-deferred-section scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl space-y-12">
        <FadeIn className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Pricing
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            {eurMonthly.label}/month — all-in-one
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Build your program first — subscribe after sign-up (skip anytime)
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            ALL prices use live rate: 1 EUR = {allPerEur.toFixed(2)} ALL
          </p>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="mb-6 flex flex-col items-center gap-3">
            <SegmentedToggle
              value={interval}
              onChange={setInterval}
              aria-label="Billing interval"
              className="w-auto"
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "annual", label: "Annual" },
              ]}
            />
          </div>

          <div className="mt-8 grid gap-6 md:max-w-lg md:mx-auto">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const tier = interval === "monthly" ? plan.monthly : plan.annual;
              const price = getCurrencyPrice(tier, currency, allPerEur);
              const savings =
                interval === "annual"
                  ? formatAnnualSavings(
                      plan.monthly.amountEurCents,
                      plan.annual.amountEurCents,
                      currency,
                      allPerEur
                    )
                  : null;

              return (
                <div
                  key={plan.id}
                  className="transition-transform duration-300 hover:-translate-y-1"
                >
                  <Card
                    className={cn(
                      "relative h-full overflow-hidden",
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
                      <div className="pt-2">
                        <span className="text-4xl font-black">{price.label}</span>
                        <span className="text-muted-foreground">
                          /{interval === "monthly" ? "mo" : "yr"}
                        </span>
                        {savings && (
                          <p className="mt-1 text-sm font-medium text-green-400">
                            {savings}
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <Link href={GET_STARTED_HREF}>
              <Button size="lg">{GET_STARTED_CTA}</Button>
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
