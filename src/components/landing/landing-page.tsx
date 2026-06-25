"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingHero } from "@/components/landing/landing-hero";
import { useTheme } from "@/components/theme-provider";
import {
  LANDING_BACKGROUND_IMAGE,
  LANDING_BACKGROUND_IMAGE_LIGHT,
} from "@/lib/landing-content";
import { cn } from "@/lib/utils";

const LandingHowItWorks = dynamic(
  () =>
    import("@/components/landing/landing-how-it-works").then((m) => ({
      default: m.LandingHowItWorks,
    })),
  { loading: () => <LandingSectionSkeleton /> }
);

const LandingAppPreview = dynamic(
  () =>
    import("@/components/landing/landing-app-preview").then((m) => ({
      default: m.LandingAppPreview,
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

const LandingCoachAlex = dynamic(
  () =>
    import("@/components/landing/landing-coach-alex").then((m) => ({
      default: m.LandingCoachAlex,
    })),
  { loading: () => <LandingSectionSkeleton /> }
);

const LandingFounderBio = dynamic(
  () =>
    import("@/components/landing/landing-founder-bio").then((m) => ({
      default: m.LandingFounderBio,
    })),
  { loading: () => <LandingSectionSkeleton /> }
);

const LandingTransformations = dynamic(
  () =>
    import("@/components/landing/landing-transformations").then((m) => ({
      default: m.LandingTransformations,
    })),
  { loading: () => <LandingSectionSkeleton /> }
);

const LandingReviews = dynamic(
  () =>
    import("@/components/landing/landing-reviews").then((m) => ({
      default: m.LandingReviews,
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
  const { theme } = useTheme();
  const backgroundImage =
    theme === "light" ? LANDING_BACKGROUND_IMAGE_LIGHT : LANDING_BACKGROUND_IMAGE;

  return (
    <div className="landing-page relative flex min-h-dvh flex-col scroll-smooth">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <Image
          key={backgroundImage}
          src={backgroundImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-b from-transparent to-background/65",
            theme === "light" ? "via-background/15" : "via-background/35"
          )}
        />
      </div>

      <div className="relative">
        <LandingNav overlay />
        <LandingHero />
      </div>
      <main className="flex-1">
        <LandingHowItWorks />
        <LandingAppPreview />
        <LandingShowcase />
        <LandingCoachAlex />
        <LandingFounderBio />
        <LandingPricing />
        <LandingTransformations />
        <LandingReviews />
        <LandingCta />
      </main>
    </div>
  );
}
