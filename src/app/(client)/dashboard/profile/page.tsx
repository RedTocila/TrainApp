import { redirect } from "next/navigation";
import { AlertTriangle, BadgeCheck, CreditCard, Gift, Settings2, UserRound } from "lucide-react";
import { getProfileWithEmail } from "@/lib/actions/profile";
import { getReferralDashboardData } from "@/lib/actions/referrals";
import { SignOutButton } from "@/components/sign-out-button";
import { ProfileSettings } from "@/components/profile-settings";
import { ProfileSubscriptionSection } from "@/components/profile-subscription-section";
import { ReferralProgram } from "@/components/referral-program";
import { AmbassadorBadge } from "@/components/ambassador-badge";
import { ClientIntakeForm } from "@/components/client-intake-form";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getReferralProgramCopy } from "@/lib/referral-program-copy";
import { getPlatformCopy } from "@/lib/platform-copy";
import { cn } from "@/lib/utils";
import { getClientIntakeStatus } from "@/lib/client-intake-utils";
import { resolveProfileGoal } from "@/lib/intake-display";

export default async function ProfilePage() {
  const profile = await getProfileWithEmail();
  if (!profile) redirect("/login");
  const intakeStatus = getClientIntakeStatus(profile);
  const platform = getPlatformCopy(parseCheckoutLocale(profile.preferred_locale));
  const referralData = await getReferralDashboardData();
  const referralCopy =
    !("error" in referralData)
      ? getReferralProgramCopy(platform, referralData)
      : null;

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <UserRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-black">{platform.profile.title}</h1>
                {profile.ambassador_tier && (
                  <AmbassadorBadge
                    tier={profile.ambassador_tier}
                    label={platform.referrals.ambassadorBadge(profile.ambassador_tier)}
                    size="sm"
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{platform.profile.subtitle}</p>
            </div>
          </div>
          <Card
            className={cn(
              intakeStatus === "complete" &&
                "!border-emerald-500/40 !bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.08)]",
              intakeStatus === "partial" &&
                "!border-amber-500/40 !bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.08)]",
              intakeStatus === "empty" &&
                "!border-red-500/40 !bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.08)]"
            )}
          >
            <CardContent className="flex items-center gap-2 p-3">
              {intakeStatus === "complete" ? (
                <BadgeCheck className="h-4 w-4 text-emerald-400" />
              ) : intakeStatus === "partial" ? (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-400" />
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {platform.profile.healthProfile}
                </p>
                <p
                  className={cn(
                    "text-xs font-black",
                    intakeStatus === "complete" && "text-emerald-300",
                    intakeStatus === "partial" && "text-amber-300",
                    intakeStatus === "empty" && "text-red-300"
                  )}
                >
                  {intakeStatus === "complete"
                    ? platform.profile.complete
                    : intakeStatus === "partial"
                      ? platform.profile.inProgress
                      : platform.profile.incomplete}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card className="overflow-hidden">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-black">{platform.profile.account}</p>
              </div>
              <ProfileSettings
                fullName={profile.full_name}
                email={profile.email}
                phone={profile.phone}
                goal={resolveProfileGoal(profile)}
                preferredLocale={profile.preferred_locale ?? "al"}
                unitSystem={profile.unit_system ?? "metric"}
                showHeader={false}
              />
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-black">{platform.profile.plan}</p>
                </div>
                <ProfileSubscriptionSection profile={profile} />
              </CardContent>
            </Card>

            {referralCopy && referralData && !("error" in referralData) && (
              <Card>
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Gift className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-black">{platform.profile.referrals}</p>
                  </div>
                  <ReferralProgram data={referralData} copy={referralCopy} compact />
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <ClientIntakeForm profile={profile} />

        <div className="pt-2">
          <SignOutButton variant="profile" />
        </div>
      </div>
    </PageTransition>
  );
}
