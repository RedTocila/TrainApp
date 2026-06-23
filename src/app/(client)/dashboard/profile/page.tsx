import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getProfileWithEmail } from "@/lib/actions/profile";
import { signOut } from "@/lib/actions/auth";
import { ProfileSettings } from "@/components/profile-settings";
import { ProfileSubscriptionSection } from "@/components/profile-subscription-section";
import { ClientIntakeForm } from "@/components/client-intake-form";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";

export default async function ProfilePage() {
  const profile = await getProfileWithEmail();
  if (!profile) redirect("/login");

  return (
    <PageTransition>
      <div className="mx-auto max-w-lg space-y-6">
        <ProfileSettings
          fullName={profile.full_name}
          email={profile.email}
          goal={profile.goal ?? null}
        />
        <ProfileSubscriptionSection profile={profile} />
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
