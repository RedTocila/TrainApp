import Link from "next/link";
import { format } from "date-fns";
import { CreditCard } from "lucide-react";
import { ProfileSubscriptionActions } from "@/components/profile-subscription-actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCoachLabels } from "@/lib/coach-copy";
import { getPlatformCopy } from "@/lib/platform-copy";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import {
  getPlan,
  type SubscriptionPlanId,
} from "@/lib/subscription-plans";
import { buildPricingHref } from "@/lib/pricing-nav";
import type { Profile } from "@/lib/types";

export function ProfileSubscriptionSection({
  profile,
}: {
  profile: Profile;
}) {
  const locale = parseCheckoutLocale(profile.preferred_locale);
  const coachLabels = getCoachLabels(locale);
  const platform = getPlatformCopy(locale);
  const planId = profile.subscription_plan as SubscriptionPlanId | null;
  const plan = planId ? getPlan(planId) : null;
  const expires = profile.subscription_expires_at
    ? format(new Date(profile.subscription_expires_at), "MMM d, yyyy")
    : null;
  const isActive = profile.subscription_status === "active";
  const isCanceled = profile.subscription_status === "canceled";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          {platform.subscription.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan && (isActive || isCanceled) ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{plan.name}</span>
              <Badge variant="secondary" className="capitalize">
                {profile.subscription_interval ?? "monthly"}
              </Badge>
              {isActive ? (
                <Badge className="bg-green-500/15 text-green-400">{platform.subscription.active}</Badge>
              ) : (
                <Badge className="bg-amber-500/15 text-amber-400">
                  {coachLabels.surrendered}
                </Badge>
              )}
            </div>
            {expires && (
              <p className="text-sm text-muted-foreground">
                {isCanceled
                  ? platform.subscription.accessUntil(expires)
                  : platform.subscription.renewsExpires(expires)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{coachLabels.noSubscription}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildPricingHref("/dashboard/profile")}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {plan ? coachLabels.levelUp : coachLabels.pickAPlan}
          </Link>
          {plan && isActive && <ProfileSubscriptionActions />}
        </div>
      </CardContent>
    </Card>
  );
}
