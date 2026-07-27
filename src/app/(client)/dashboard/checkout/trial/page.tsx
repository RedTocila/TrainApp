import { redirect } from "next/navigation";
import { requireClient } from "@/lib/actions/auth";
import { getPreferredLocale } from "@/lib/actions/profile";
import { getCheckoutReferralState } from "@/lib/actions/referrals";
import { TrialCheckoutClient } from "@/components/trial-checkout-client";
import { PageTransition } from "@/components/page-transition";
import { isEligibleForAiProTrial } from "@/lib/subscription";
import type { BillingInterval } from "@/lib/subscription-plans";
import { getPlanPrice } from "@/lib/subscription-plans";
import { FREE_TRIAL_PLAN_ID } from "@/lib/subscription";

export default async function TrialCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string }>;
}) {
  const profile = await requireClient();
  const params = await searchParams;
  const interval = (params.interval === "annual" ? "annual" : "monthly") as BillingInterval;
  const locale = await getPreferredLocale();

  if (!isEligibleForAiProTrial(profile)) {
    redirect("/dashboard/pricing");
  }

  const displayPrice = getPlanPrice(FREE_TRIAL_PLAN_ID, interval);
  if (!displayPrice) {
    redirect("/dashboard/pricing");
  }

  const referral = await getCheckoutReferralState(profile.id);

  return (
    <PageTransition>
      <TrialCheckoutClient
        interval={interval}
        locale={locale}
        displayPrice={displayPrice}
        canApplyReferralCode={referral.canApplyCode}
      />
    </PageTransition>
  );
}
