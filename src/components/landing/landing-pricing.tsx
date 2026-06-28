"use client";

import Link from "next/link";
import { useState } from "react";
import { SegmentedToggle } from "@/components/segmented-toggle";
import {
  GET_STARTED_CTA,
  GET_STARTED_HREF,
} from "@/lib/landing-content";
import {
  SUBSCRIPTION_PLANS,
  type BillingInterval,
} from "@/lib/subscription-plans";
import { formatAnnualSavings } from "@/lib/checkout-i18n";
import { PricingPlanCard } from "@/components/pricing-plan-card";
import { FadeIn } from "@/components/landing/landing-motion";
import { Button } from "@/components/ui/button";

const LANDING_LABELS = {
  perMonth: "mo",
  perYear: "yr",
  currentPlan: "Current plan",
  switchPlan: "Switch plan",
  subscribe: "Subscribe",
  includesFrom: (planName: string) => `Everything in ${planName}, plus:`,
};

export function LandingPricing() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  return (
    <section id="pricing" className="landing-deferred-section scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl space-y-12">
        <FadeIn className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Pricing
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Plans that grow with your goals
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            From €5/month for structured tracking to AI coaching and elite community
            access — build your program first, subscribe when you&apos;re ready.
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

          <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-3 md:grid-cols-2 md:items-end">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const savings =
                interval === "annual"
                  ? formatAnnualSavings(plan.monthly, plan.annual)
                  : null;

              return (
                <PricingPlanCard
                  key={plan.id}
                  plan={plan}
                  interval={interval}
                  labels={LANDING_LABELS}
                  savings={savings}
                  showCta={false}
                />
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <Link href={GET_STARTED_HREF}>
              <Button size="lg" className="shadow-lg shadow-primary/20">
                {GET_STARTED_CTA}
              </Button>
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
