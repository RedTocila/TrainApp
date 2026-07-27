import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/actions/auth";
import { PublicPricingClient } from "@/components/public-pricing-client";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { FadeIn } from "@/components/landing/landing-motion";
import { GET_STARTED_CTA, GET_STARTED_HREF, SITE_URL } from "@/lib/landing-content";
import { PLATFORM_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: `Pricing — ${PLATFORM_NAME}`,
  description: "Free manual tracking. AI Pro from €20/month. Elite community from €30/month.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: `Pricing — ${PLATFORM_NAME}`,
    description: "Free for manual workouts and meals. Upgrade for AI coaching and Elite community.",
    url: `${SITE_URL}/pricing`,
  },
};

export default async function PublicPricingPage() {
  const profile = await getProfile();

  if (profile?.role === "client") {
    redirect("/dashboard/pricing");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <LandingNav />
      <main className="flex-1 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-8">
          <FadeIn className="space-y-2 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Pricing
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Plans that grow with your goals
            </h1>
            <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
              Free for manual workouts, meals, and tracking. Upgrade for AI coaching
              (€20) or Elite community (€30).
            </p>
          </FadeIn>
          <PublicPricingClient />
          <p className="text-center text-sm text-muted-foreground">
            Create a free account to start training manually, then upgrade anytime.{" "}
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
