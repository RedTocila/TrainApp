import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronRight,
  ExternalLink,
  Gift,
  Scale,
  UserRound,
} from "lucide-react";
import { getProfileWithEmail } from "@/lib/actions/profile";
import { SignOutButton } from "@/components/sign-out-button";
import { ProfileSettings } from "@/components/profile-settings";
import { ReminderSettingsCard } from "@/components/reminder-settings-card";
import { ProfileSubscriptionSection } from "@/components/profile-subscription-section";
import { HiddenInFreeApp } from "@/components/ios/native-platform-gate";
import { DeleteOwnAccountSection } from "@/components/delete-own-account-section";
import { PageTransition } from "@/components/page-transition";
import { ProfileSupportCard } from "@/components/profile-support-card";
import { Card, CardContent } from "@/components/ui/card";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import { cn } from "@/lib/utils";
import { getClientIntakeStatus } from "@/lib/client-intake-utils";
import { buttonVariants } from "@/components/ui/button";
import { hasPlusAccess } from "@/lib/subscription";
import { REFERRALS_ENABLED } from "@/lib/referral";

export default async function ProfilePage() {
  const profile = await getProfileWithEmail();
  if (!profile) redirect("/login");
  const intakeStatus = getClientIntakeStatus(profile);
  const platform = getPlatformCopy(parseCheckoutLocale(profile.preferred_locale));

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <UserRound className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-lg font-black leading-none">{platform.profile.title}</h1>
          </div>
          <Card className="dashboard-flat-card">
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
          <div className="space-y-3">
            <ProfileSettings
              fullName={profile.full_name}
              email={profile.email}
              phone={profile.phone}
              preferredLocale={profile.preferred_locale ?? "al"}
              macros={{
                calories: profile.target_calories ?? 2000,
                protein: profile.target_protein ?? 150,
                carbs: profile.target_carbs ?? 200,
                fat: profile.target_fat ?? 65,
              }}
              showHeader={false}
            />
            <ReminderSettingsCard
              initialSettings={profile.reminder_settings}
              locked={!hasPlusAccess(profile)}
            />
          </div>

          <HiddenInFreeApp>
            <ProfileSubscriptionSection profile={profile} />
          </HiddenInFreeApp>
        </div>

        {REFERRALS_ENABLED ? (
        <HiddenInFreeApp>
          <Link
            href="/dashboard/referrals"
            className="dashboard-flat-card block rounded-3xl text-card-foreground active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">{platform.referral.profileCardTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {platform.referral.profileCardHint}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </Link>
        </HiddenInFreeApp>
        ) : null}

        <ProfileSupportCard copy={platform.support} />

        <Card className="dashboard-flat-card">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black">{platform.profile.legal}</p>
                <p className="text-xs text-muted-foreground">
                  {platform.profile.legalHint}
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "justify-between rounded-xl"
                )}
              >
                {platform.profile.privacyPolicy}
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </Link>
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "justify-between rounded-xl"
                )}
              >
                {platform.profile.termsOfService}
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <DeleteOwnAccountSection
          appleBilled={Boolean(profile.apple_original_transaction_id)}
        />

        <div className="pt-2">
          <SignOutButton variant="profile" />
        </div>
      </div>
    </PageTransition>
  );
}
