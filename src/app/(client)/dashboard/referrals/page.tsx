import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { getReferralDashboardData } from "@/lib/actions/referrals";
import { getProfileWithEmail } from "@/lib/actions/profile";
import { ReferralProgram } from "@/components/referral-program";
import { ReferralPackageActions } from "@/components/referral-package-actions";
import { ReferralsBackButton } from "@/components/referrals-back-button";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getReferralProgramCopy } from "@/lib/referral-program-copy";
import { getPlatformCopy } from "@/lib/platform-copy";

export default async function ReferralsPage() {
  const profile = await getProfileWithEmail();
  if (!profile) redirect("/login");

  const data = await getReferralDashboardData();
  if ("error" in data) redirect("/dashboard/profile");

  const platform = getPlatformCopy(parseCheckoutLocale(profile.preferred_locale));
  const referralCopy = getReferralProgramCopy(platform, data);

  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl space-y-5">
        <Suspense
          fallback={
            <div className="h-8 w-16 animate-pulse rounded-md bg-muted/50" aria-hidden />
          }
        >
          <ReferralsBackButton />
        </Suspense>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Gift className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black">{platform.referrals.title}</h1>
            <p className="text-xs text-muted-foreground">{platform.referrals.subtitle}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <ReferralProgram data={data} copy={referralCopy} />
          </CardContent>
        </Card>

        <ReferralPackageActions
          profile={profile}
          referralLink={data.referralLink}
          copy={{
            activatePackagesTitle: platform.referrals.activatePackagesTitle,
            activatePackagesHint: platform.referrals.activatePackagesHint,
            activateAi: platform.referrals.activateAi,
            upgradeAi: platform.referrals.upgradeAi,
            viewAllPlans: platform.referrals.viewAllPlans,
            currentPlanLabel: platform.referrals.currentPlanLabel,
            yourPackages: platform.referrals.yourPackages,
            inviteFriends: platform.referrals.inviteFriends,
            inviteFriendAi: platform.referrals.inviteFriendAi,
            qualifyingPlanNote: platform.referrals.qualifyingPlanNote,
          }}
        />
      </div>
    </PageTransition>
  );
}
