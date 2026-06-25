import Link from "next/link";
import { Crown, Sparkles } from "lucide-react";
import { hasPaidAccess } from "@/lib/subscription";
import { subscriptionLabel } from "@/lib/subscription";
import { getCoachLabels } from "@/lib/coach-copy";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SubscriptionBanner({ profile }: { profile: Profile }) {
  const coachLabels = getCoachLabels(parseCheckoutLocale(profile.preferred_locale));
  if (hasPaidAccess(profile)) return null;

  return (
    <Card className="mb-4 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent sm:mb-6">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/15 p-2.5">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">{coachLabels.unlockDashboard}</p>
            <p className="text-sm text-muted-foreground">{coachLabels.subscribeBlurb}</p>
          </div>
        </div>
        <Link href="/dashboard/pricing" className="shrink-0">
          <Button>
            <Sparkles className="mr-2 h-4 w-4" />
            {coachLabels.viewPlans}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function SubscriptionStatusChip({ profile }: { profile: Profile }) {
  if (!hasPaidAccess(profile)) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-400">
      {subscriptionLabel(profile.subscription_plan, profile.subscription_interval ?? null)}
    </span>
  );
}
