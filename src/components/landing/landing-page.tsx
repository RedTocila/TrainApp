"use client";

import { LandingNav } from "@/components/landing/landing-nav";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingHowItWorks } from "@/components/landing/landing-how-it-works";
import { LandingShowcase } from "@/components/landing/landing-showcase";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

export function LandingPageClient() {
  return (
    <div className="landing-page flex min-h-dvh flex-col scroll-smooth">
      <LandingNav />
      <main className="flex-1">
        <LandingHero />
        <LandingHowItWorks />
        <LandingShowcase />
        <LandingFeatures />
        <LandingPricing />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
