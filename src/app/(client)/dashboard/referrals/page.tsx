import { redirect } from "next/navigation";
import { getReferralDashboard } from "@/lib/actions/referrals";
import { ReferralsClient } from "@/components/referrals-client";
import { PageTransition } from "@/components/page-transition";
import { REFERRALS_ENABLED } from "@/lib/referral";

export default async function ReferralsPage() {
  if (!REFERRALS_ENABLED) redirect("/dashboard/profile");
  const data = await getReferralDashboard();
  if ("error" in data) redirect("/login");

  return (
    <PageTransition>
      <ReferralsClient initial={data} />
    </PageTransition>
  );
}
