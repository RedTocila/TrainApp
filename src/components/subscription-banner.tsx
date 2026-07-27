"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, Sparkles } from "lucide-react";
import {
  freeTrialDaysRemaining,
  hasPaidAccess,
  isOnFreeTrial,
  subscriptionLabel,
} from "@/lib/subscription";
import { getCoachLabels } from "@/lib/coach-copy";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { buildPricingHref } from "@/lib/pricing-nav";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SubscriptionBanner({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const coachLabels = getCoachLabels(parseCheckoutLocale(profile.preferred_locale));
  const onTrial = isOnFreeTrial(profile);
  const daysLeft = freeTrialDaysRemaining(profile);

  if (pathname.startsWith("/dashboard/pricing")) return null;

  if (onTrial) {
    return (
      <Card className="mb-3 border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
        <CardContent className="flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="shrink-0 rounded-md bg-amber-500/15 p-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug">{coachLabels.trialUnlockTitle}</p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground sm:line-clamp-1">
                {coachLabels.trialUnlockBlurb(daysLeft ?? 0)}
              </p>
            </div>
          </div>
          <Link href={buildPricingHref(pathname)} className="shrink-0 sm:self-center">
            <Button size="sm" className="w-full sm:w-auto">
              <Crown className="mr-1.5 h-3.5 w-3.5" />
              {coachLabels.keepAiPro}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (hasPaidAccess(profile)) return null;

  return (
    <Card className="mb-3 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
      <CardContent className="flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="shrink-0 rounded-md bg-primary/15 p-1.5">
            <Crown className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{coachLabels.unlockDashboard}</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground sm:line-clamp-1">
              {coachLabels.subscribeBlurb}
            </p>
          </div>
        </div>
        <Link href={buildPricingHref(pathname)} className="shrink-0 sm:self-center">
          <Button size="sm" className="w-full sm:w-auto">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {coachLabels.viewPlans}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function SubscriptionStatusChip({ profile }: { profile: Profile }) {
  if (!hasPaidAccess(profile)) return null;

  const onTrial = isOnFreeTrial(profile);
  const daysLeft = freeTrialDaysRemaining(profile);

  return (
    <span
      className={
        onTrial
          ? "inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400"
          : "inline-flex items-center rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-400"
      }
    >
      {subscriptionLabel(profile.subscription_plan, profile.subscription_interval ?? null, {
        trial: onTrial,
        trialDaysLeft: daysLeft,
      })}
    </span>
  );
}
