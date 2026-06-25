import { redirect } from "next/navigation";
import { AlertTriangle, BadgeCheck, CreditCard, LogOut, Settings2, UserRound } from "lucide-react";
import { getProfileWithEmail } from "@/lib/actions/profile";
import { signOut } from "@/lib/actions/auth";
import { ProfileSettings } from "@/components/profile-settings";
import { ProfileSubscriptionSection } from "@/components/profile-subscription-section";
import { ClientIntakeForm } from "@/components/client-intake-form";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getClientIntakeStatus } from "@/lib/client-intake-utils";

export default async function ProfilePage() {
  const profile = await getProfileWithEmail();
  if (!profile) redirect("/login");
  const intakeStatus = getClientIntakeStatus(profile);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <UserRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black">Profile</h1>
              <p className="text-xs text-muted-foreground">Account · subscription · health profile</p>
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
                  Health profile
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
                    ? "Complete"
                    : intakeStatus === "partial"
                      ? "In progress"
                      : "Incomplete"}
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
                <p className="text-sm font-black">Account</p>
              </div>
              <ProfileSettings
                fullName={profile.full_name}
                email={profile.email}
                phone={profile.phone}
                goal={profile.goal ?? null}
                preferredLocale={profile.preferred_locale ?? "al"}
                showHeader={false}
              />
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-black">Plan</p>
                </div>
                <ProfileSubscriptionSection profile={profile} />
              </CardContent>
            </Card>
          </div>
        </div>

        <ClientIntakeForm profile={profile} />

        <form action={signOut} className="pt-2">
          <Button type="submit" variant="outline" className="w-full">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </form>
      </div>
    </PageTransition>
  );
}
