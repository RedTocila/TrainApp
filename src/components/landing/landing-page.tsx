"use client";

import dynamic from "next/dynamic";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingHero } from "@/components/landing/landing-hero";

const LandingHowItWorks = dynamic(
  () =>
    import("@/components/landing/landing-how-it-works").then((m) => ({
      default: m.LandingHowItWorks,
    })),
  { loading: () => <LandingSectionSkeleton /> }
);

const LandingShowcase = dynamic(
  () =>
    import("@/components/landing/landing-showcase").then((m) => ({
      default: m.LandingShowcase,
    })),
  { loading: () => <LandingSectionSkeleton /> }
);

const LandingFeatures = dynamic(
  () =>
    import("@/components/landing/landing-features").then((m) => ({
      default: m.LandingFeatures,
    })),
  { loading: () => <LandingSectionSkeleton /> }
);

const LandingPricing = dynamic(
  () =>
    import("@/components/landing/landing-pricing").then((m) => ({
      default: m.LandingPricing,
    })),
  { loading: () => <LandingSectionSkeleton /> }
);

const LandingCta = dynamic(
  () =>
    import("@/components/landing/landing-cta").then((m) => ({
      default: m.LandingCta,
    })),
  { loading: () => <LandingSectionSkeleton /> }
);

function LandingSectionSkeleton() {
  return <div className="landing-section-skeleton" aria-hidden />;
}

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
    </div>
  );
}
