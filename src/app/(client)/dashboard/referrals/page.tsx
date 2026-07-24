import { redirect } from "next/navigation";
import { getReferralDashboard } from "@/lib/actions/referrals";
import { ReferralsClient } from "@/components/referrals-client";
import { PageTransition } from "@/components/page-transition";

export default async function ReferralsPage() {
  const data = await getReferralDashboard();
  if ("error" in data) redirect("/login");

  return (
    <PageTransition>
      <ReferralsClient initial={data} />
    </PageTransition>
  );
}
