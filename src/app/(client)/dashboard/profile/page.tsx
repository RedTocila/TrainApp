import { redirect } from "next/navigation";
import { BadgeCheck, CreditCard, LogOut, Settings2, UserRound } from "lucide-react";
import { getProfileWithEmail } from "@/lib/actions/profile";
import { signOut } from "@/lib/actions/auth";
import { ProfileSettings } from "@/components/profile-settings";
import { ProfileSubscriptionSection } from "@/components/profile-subscription-section";
import { ClientIntakeForm } from "@/components/client-intake-form";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";

export default async function ProfilePage() {
  const profile = await getProfileWithEmail();
  if (!profile) redirect("/login");
  const intakeComplete = isClientIntakeComplete(profile);

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
          <Card className={intakeComplete ? "border-emerald-500/20 bg-emerald-500/[0.05]" : "border-red-500/20 bg-red-500/[0.04]"}>
            <CardContent className="flex items-center gap-2 p-3">
              <BadgeCheck className={intakeComplete ? "h-4 w-4 text-emerald-300" : "h-4 w-4 text-red-300"} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Health profile
                </p>
                <p className="text-xs font-black">{intakeComplete ? "Complete" : "Incomplete"}</p>
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
