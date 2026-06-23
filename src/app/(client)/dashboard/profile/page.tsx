import { redirect } from "next/navigation";
import { getProfileWithEmail } from "@/lib/actions/profile";
import { ProfileSettings } from "@/components/profile-settings";
import { PageTransition } from "@/components/page-transition";

export default async function ProfilePage() {
  const profile = await getProfileWithEmail();
  if (!profile) redirect("/login");

  return (
    <PageTransition>
      <ProfileSettings
        fullName={profile.full_name}
        email={profile.email}
        goal={profile.goal ?? null}
      />
    </PageTransition>
  );
}
