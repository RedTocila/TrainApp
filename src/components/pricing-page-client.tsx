"use client";
import { usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { PricingBackButton } from "@/components/pricing-back-button";
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
  const platform = usePlatformCopy();
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const subscribed = hasPaidAccess(profile);

  // After email confirmation, finish profile setup (intake draft, phone).
  useEffect(() => {
    if (!onboarding) return;
    const draft = loadIntakeDraft();

    void completeRegistration({
      fullName: profile.full_name,
      email: "",
      phone: profile.phone ?? null,
      intakeJson: draft ? JSON.stringify(draft) : null,
    }).then((result) => {
      if ("success" in result && result.success && draft) clearIntakeDraft();
    });
  }, [onboarding, profile.full_name, profile.phone]);

  return (
    <div className="relative mx-auto max-w-6xl space-y-8">
      {onboarding ? (
        <div className="flex items-center justify-between gap-3">
          <Suspense
            fallback={
              <div className="h-8 w-16 animate-pulse rounded-md bg-muted/50" aria-hidden />
            }
          >
            <PricingBackButton />
          </Suspense>
          <Link href="/dashboard" aria-label={platform.pricing.skipForNow}>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg border border-border bg-secondary/40"
            >
              <X className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="h-8 w-16 animate-pulse rounded-md bg-muted/50" aria-hidden />
          }
        >
          <PricingBackButton />
        </Suspense>
      )}
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
      {onboarding && (
        <div className="text-center">
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2">
              {platform.pricing.skipForNow}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
