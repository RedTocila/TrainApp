import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/actions/auth";
import { PublicPricingClient } from "@/components/public-pricing-client";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { FadeIn } from "@/components/landing/landing-motion";
import { GET_STARTED_CTA, GET_STARTED_HREF, SITE_URL } from "@/lib/landing-content";
import { PLATFORM_AI_NAME, PLATFORM_NAME } from "@/lib/brand";
import { getCachedAllPerEur } from "@/lib/exchange-rates";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: `Pricing — ${PLATFORM_NAME}`,
  description: `${PLATFORM_AI_NAME} from €19/month. Custom trainer plans from €49.`,
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: `Pricing — ${PLATFORM_NAME}`,
    description: "Simple pricing for workouts, nutrition, AI coaching, and live sessions.",
    url: `${SITE_URL}/pricing`,
  },
};

export default async function PublicPricingPage() {
  const profile = await getProfile();
  const allPerEur = await getCachedAllPerEur();

  if (profile?.role === "client") {
    redirect("/dashboard/pricing");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <LandingNav />
      <main className="flex-1 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-lg space-y-8">
          <FadeIn className="space-y-2 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Pricing
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              One plan, everything included
            </h1>
            <p className="text-sm text-muted-foreground">
              {PLATFORM_AI_NAME} — €19/month. Build your program first, then subscribe.
            </p>
          </FadeIn>
          <PublicPricingClient allPerEur={allPerEur} />
          <p className="text-center text-sm text-muted-foreground">
            Create an account first, then choose a plan from your dashboard.{" "}
            <Link href="/" className="text-primary hover:underline">
              Back to home
            </Link>
          </p>
          <div className="flex justify-center">
            <Link href={GET_STARTED_HREF}>
              <Button size="lg">{GET_STARTED_CTA}</Button>
            </Link>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
