"use client";

import Link from "next/link";
import { format } from "date-fns";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPlan,
  type SubscriptionPlanId,
} from "@/lib/subscription-plans";
import type { Profile } from "@/lib/types";

export function ProfileSubscriptionSection({
  profile,
}: {
  profile: Profile;
}) {
  const planId = profile.subscription_plan as SubscriptionPlanId | null;
  const plan = planId ? getPlan(planId) : null;
  const expires = profile.subscription_expires_at
    ? format(new Date(profile.subscription_expires_at), "MMM d, yyyy")
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Subscription & plans
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan && profile.subscription_status === "active" ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{plan.name}</span>
              <Badge variant="secondary" className="capitalize">
                {profile.subscription_interval ?? "monthly"}
              </Badge>
              <Badge className="bg-green-500/15 text-green-400">Active</Badge>
            </div>
            {expires && (
              <p className="text-sm text-muted-foreground">
                Renews / expires {expires}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No active subscription. Browse free, subscribe to save workouts,
            nutrition, habits, and more.
          </p>
        )}
        <Link href="/dashboard/pricing" className={buttonVariants({ variant: "outline", size: "sm" })}>
          {plan ? "Change plan" : "View plans & pricing"}
        </Link>
      </CardContent>
    </Card>
  );
}
