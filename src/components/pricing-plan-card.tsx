"use client";

import Link from "next/link";
import {
  Check,
  Crown,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { BillingInterval, SubscriptionPlan } from "@/lib/subscription-plans";
import { getCurrencyPrice } from "@/lib/checkout-i18n";
import { getPricingFeatureIcon } from "@/lib/pricing-feature-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type PricingCardLabels = {
  perMonth: string;
  perYear: string;
  currentPlan: string;
  switchPlan: string;
  subscribe: string;
  includesFrom: (planName: string) => string;
};

type PricingPlanCardProps = {
  plan: SubscriptionPlan;
  interval: BillingInterval;
  labels: PricingCardLabels;
  savings?: string | null;
  isCurrent?: boolean;
  subscribed?: boolean;
  checkoutHref?: string;
  showCta?: boolean;
  className?: string;
};

function FeatureRow({ feature, icon: Icon }: { feature: string; icon: LucideIcon }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Icon className="h-3 w-3 text-primary" aria-hidden />
      </span>
      <span className="text-muted-foreground">{feature}</span>
    </li>
  );
}

export function PricingPlanCard({
  plan,
  interval,
  labels,
  savings,
  isCurrent = false,
  subscribed = false,
  checkoutHref,
  showCta = true,
  className,
}: PricingPlanCardProps) {
  const tier = interval === "monthly" ? plan.monthly : plan.annual;
  const price = getCurrencyPrice(tier);
  const isElite = plan.id === "elite";

  return (
    <div
      className={cn(
        "group relative transition-all duration-300 ease-out",
        "hover:-translate-y-1.5",
        plan.highlighted && "md:-mt-2 md:mb-2",
        className
      )}
    >
      <Card
        className={cn(
          "relative flex h-full flex-col overflow-hidden border-border/80 bg-card/95 backdrop-blur-sm",
          "transition-all duration-300 group-hover:border-primary/40 group-hover:shadow-xl group-hover:shadow-primary/10",
          plan.highlighted &&
            "border-primary/60 shadow-lg shadow-primary/15 ring-1 ring-primary/20",
          isElite && "border-amber-500/30 group-hover:border-amber-500/50"
        )}
      >
        {plan.highlighted && (
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
        )}

        {plan.badge && (
          <div className="absolute right-4 top-4 z-10">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
                plan.highlighted
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                  : "bg-primary/15 text-primary"
              )}
            >
              {plan.highlighted ? (
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Crown className="h-3.5 w-3.5" aria-hidden />
              )}
              {plan.badge}
            </span>
          </div>
        )}

        <CardHeader className={cn("space-y-3 pb-4", plan.badge && "pt-10")}>
          <div className="space-y-1">
            <CardTitle className="text-xl font-black tracking-tight">{plan.name}</CardTitle>
            <p className="text-sm leading-relaxed text-muted-foreground">{plan.tagline}</p>
          </div>
          <div className="pt-1">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tight">{price.label}</span>
              <span className="text-sm text-muted-foreground">
                /{interval === "monthly" ? labels.perMonth : labels.perYear}
              </span>
            </div>
            {savings && (
              <p className="mt-1.5 text-sm font-medium text-green-400">{savings}</p>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col space-y-5 pb-6">
          {plan.includesFrom && (
            <div className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {labels.includesFrom(plan.includesFrom)}
              </p>
            </div>
          )}

          <ul className="flex-1 space-y-2.5">
            {plan.features.map((feature) => (
              <FeatureRow
                key={feature}
                feature={feature}
                icon={getPricingFeatureIcon(feature)}
              />
            ))}
          </ul>

          {showCta && checkoutHref && (
            <div className="pt-2">
              {isCurrent ? (
                <Button className="w-full" variant="outline" disabled>
                  {labels.currentPlan}
                </Button>
              ) : (
                <Link href={checkoutHref} className="block">
                  <Button
                    className={cn(
                      "w-full transition-transform duration-200 group-hover:scale-[1.02]",
                      plan.highlighted && "shadow-md shadow-primary/25"
                    )}
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {subscribed ? labels.switchPlan : labels.subscribe}
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
