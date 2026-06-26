"use client";
import { useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { completeRegistration } from "@/lib/actions/auth";
import { PricingPlans } from "@/components/pricing-plans";
import { Button } from "@/components/ui/button";
import { loadIntakeDraft, clearIntakeDraft } from "@/lib/intake-storage";
import type { BillingInterval } from "@/lib/subscription-plans";
import type { Profile } from "@/lib/types";
import { hasPaidAccess } from "@/lib/subscription";

export function PricingPageClient({
  profile,
  onboarding = false,
}: {
  profile: Profile;
  onboarding?: boolean;
}) {
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const subscribed = hasPaidAccess(profile);

  // Email-confirmation path: intake draft may still be in sessionStorage
  useEffect(() => {
    if (!onboarding) return;
    const draft = loadIntakeDraft();
    if (!draft) return;

    void completeRegistration({
      fullName: profile.full_name,
      email: "",
      phone: profile.phone ?? null,
      intakeJson: JSON.stringify(draft),
    }).then((result) => {
      if (result.success) clearIntakeDraft();
    });
  }, [onboarding, profile.full_name, profile.phone]);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="space-y-2 text-center">
        {onboarding && (
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {platform.pricing.step}
          </p>
        )}
        <h1 className="text-3xl font-black tracking-tight">{platform.pricing.choosePlan}</h1>
        <p className="text-sm text-muted-foreground">
          {onboarding ? platform.pricing.onboardingBlurb : platform.pricing.upgradeBlurb}
        </p>
      </div>
      <PricingPlans
        interval={interval}
        onIntervalChange={setInterval}
        currentPlan={profile.subscription_plan}
        subscribed={subscribed}
      />
      {onboarding && !subscribed && (
        <div className="text-center">
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2 text-muted-foreground">
              {coachLabels.skipForNow}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
