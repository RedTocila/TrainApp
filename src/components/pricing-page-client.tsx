"use client";

import { useState } from "react";
import { PricingPlans } from "@/components/pricing-plans";
import type { BillingInterval } from "@/lib/subscription-plans";
import type { Profile } from "@/lib/types";
import { hasPaidAccess } from "@/lib/subscription";

export function PricingPageClient({ profile }: { profile: Profile }) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const subscribed = hasPaidAccess(profile);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-black tracking-tight">Choose your plan</h1>
        <p className="text-muted-foreground">
          Start with Core for full tracking and AI Coach insights, or upgrade to AI for plan
          builders, photo meal logging, and live sessions.
        </p>
      </div>
      <PricingPlans
        interval={interval}
        onIntervalChange={setInterval}
        currentPlan={profile.subscription_plan}
        subscribed={subscribed}
      />
    </div>
  );
}
