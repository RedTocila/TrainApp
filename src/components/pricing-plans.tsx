"use client";

import { SegmentedToggle } from "@/components/segmented-toggle";
import { PricingPlanCard } from "@/components/pricing-plan-card";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import type { BillingInterval } from "@/lib/subscription-plans";
import {
  formatAnnualSavingsLocalized,
  getLocalizedSubscriptionPlans,
  getPricingCardLabels,
} from "@/lib/subscription-plans-i18n";

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
  const cardLabels = getPricingCardLabels(locale);

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-3">
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

      <div className="grid items-stretch gap-6 lg:grid-cols-3 md:grid-cols-2 md:items-end">
        {plans.map((plan) => {
          const savings =
            interval === "annual"
              ? formatAnnualSavingsLocalized(plan.monthly, plan.annual, locale)
              : null;
          const isCurrent = subscribed && currentPlan === plan.id;

          return (
            <PricingPlanCard
              key={plan.id}
              plan={plan}
              interval={interval}
              labels={cardLabels}
              savings={savings}
              isCurrent={isCurrent}
              subscribed={subscribed}
              checkoutHref={`${checkoutBasePath}?plan=${plan.id}&interval=${interval}`}
            />
          );
        })}
      </div>
    </div>
  );
}
