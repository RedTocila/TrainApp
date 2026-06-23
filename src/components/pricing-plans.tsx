"use client";

import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { AiFoodDemoIllustration } from "@/components/ai-food-demo-illustration";
import type { BillingInterval, SubscriptionPlan } from "@/lib/subscription-plans";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function annualSavings(plan: SubscriptionPlan): string | null {
  const monthlyYear = plan.monthly.amountCents * 12;
  const saved = monthlyYear - plan.annual.amountCents;
  if (saved <= 0) return null;
  return `Save €${(saved / 100).toFixed(0)}/year`;
}

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
  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-border bg-secondary/50 p-1">
          <button
            type="button"
            onClick={() => onIntervalChange("monthly")}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              interval === "monthly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => onIntervalChange("annual")}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              interval === "annual"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Annual
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const price = interval === "monthly" ? plan.monthly : plan.annual;
          const savings = interval === "annual" ? annualSavings(plan) : null;
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
                    /{interval === "monthly" ? "mo" : "yr"}
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
                    Current plan
                  </Button>
                ) : (
                  <Link href={`${checkoutBasePath}?plan=${plan.id}&interval=${interval}`}>
                    <Button className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                      {subscribed ? "Switch plan" : "Subscribe"}
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
