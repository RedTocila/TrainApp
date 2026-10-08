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
import { PLATFORM_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function PricingPageClient({
  profile,
  onboarding = false,
}: {
  profile: Profile;
  onboarding?: boolean;
}) {
  const platform = usePlatformCopy();
  const [interval, setInterval] = useState<BillingInterval>("annual");
  const subscribed = hasPaidAccess(profile);
  const firstName =
    profile.full_name?.trim().split(/\s+/)[0] ||
    profile.full_name?.trim() ||
    PLATFORM_NAME;

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
    <div className="relative mx-auto flex min-h-[calc(100dvh-5rem)] max-w-lg flex-col">
      <div className="flex items-center justify-between gap-3 px-1">
        {onboarding ? (
          <>
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
                className="h-9 w-9 shrink-0 rounded-full border border-border/60 bg-secondary/30"
              >
                <X className="h-4 w-4" />
              </Button>
            </Link>
          </>
        ) : (
          <Suspense
            fallback={
              <div className="h-8 w-16 animate-pulse rounded-md bg-muted/50" aria-hidden />
            }
          >
            <PricingBackButton />
          </Suspense>
        )}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-4 pt-6">
        <div className="space-y-4 text-center">
          {onboarding ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              {platform.pricing.step}
            </p>
          ) : null}
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-3 py-1.5">
            <span className="text-sm font-black tracking-tight">{PLATFORM_NAME}</span>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary-foreground">
              Pro
            </span>
          </div>
          <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">
            {onboarding
              ? platform.pricing.planReadyHeadline(firstName)
              : platform.pricing.choosePlan}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {onboarding ? (
              <>
                {platform.pricing.planReadySub.split(", ").map((part, index, all) => (
                  <span key={part}>
                    {index === all.length - 1 ? (
                      <span className="font-bold text-foreground">{part}</span>
                    ) : (
                      <>
                        {part}
                        {index < all.length - 1 ? ", " : ""}
                      </>
                    )}
                  </span>
                ))}
              </>
            ) : (
              platform.pricing.upgradeBlurb
            )}
          </p>
        </div>

        <div
          className={cn(
            onboarding
              ? "mt-auto rounded-t-[2rem] border border-border/60 bg-zinc-950/90 px-1 pb-2 pt-5 shadow-[0_-24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md"
              : "mt-6"
          )}
        >
          <PricingPlans
            interval={interval}
            onIntervalChange={setInterval}
            currentPlan={profile.subscription_plan}
            subscribed={subscribed}
            premiumPresentation={onboarding}
          />
          {onboarding ? (
            <p className="px-4 pb-1 pt-2 text-center text-[10px] leading-relaxed text-muted-foreground">
              {platform.pricing.renewsFooter}
            </p>
          ) : null}
        </div>
      </div>

      {onboarding && (
        <div className="px-2 pb-2 text-center">
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2 text-muted-foreground">
              {platform.pricing.skipForNow}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
