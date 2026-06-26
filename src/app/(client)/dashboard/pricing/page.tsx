import { requireClient } from "@/lib/actions/auth";
import { PricingPageClient } from "@/components/pricing-page-client";
import { PageTransition } from "@/components/page-transition";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const profile = await requireClient();
  const params = await searchParams;
  const onboarding = params.onboarding === "1";

  return (
    <PageTransition>
      <PricingPageClient profile={profile} onboarding={onboarding} />
    </PageTransition>
  );
}
