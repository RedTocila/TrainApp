import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import { getWeekPlanPreview } from "@/lib/actions/user-workouts";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { getPlatformCopy } from "@/lib/platform-copy";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { WeekPlanPreviewClient } from "@/components/week-plan-preview-client";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";

export default async function WeekPlanPreviewPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  await requireClient();
  const { planId } = await params;

  const [preview, profile] = await Promise.all([
    getWeekPlanPreview(planId),
    getSubscriptionProfile(),
  ]);

  if (!preview) notFound();

  const platform = getPlatformCopy(
    parseCheckoutLocale(profile?.preferred_locale)
  );

  return (
    <PageTransition>
      <div className="w-full space-y-4 pb-8">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/workout/plans">
            <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1 px-2">
              <ArrowLeft className="h-4 w-4" />
              {platform.workout.weekPlansTitle}
            </Button>
          </Link>
        </div>
        <WeekPlanPreviewClient
          plan={preview.plan}
          workouts={preview.workouts}
          gender={profile?.gender}
        />
      </div>
    </PageTransition>
  );
}
