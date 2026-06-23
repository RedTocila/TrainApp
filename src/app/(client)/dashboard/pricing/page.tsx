import { redirect } from "next/navigation";
import { requireClient } from "@/lib/actions/auth";
import { PricingPageClient } from "@/components/pricing-page-client";
import { PageTransition } from "@/components/page-transition";

export default async function PricingPage() {
  const profile = await requireClient();

  return (
    <PageTransition>
      <PricingPageClient profile={profile} />
    </PageTransition>
  );
}
