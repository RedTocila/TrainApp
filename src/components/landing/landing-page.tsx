"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingHero, LandingStickyCta } from "@/components/landing/landing-hero";
import { loadIntakeDraft, saveIntakeDraft } from "@/lib/intake-storage";
import {
  GET_STARTED_HREF,
  LANDING_BACKGROUND_IMAGE,
  LANDING_MAIN_GOALS,
  LANDING_PLAN_CTA,
} from "@/lib/landing-content";

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

const LandingChallenges = dynamic(
  () =>
    import("@/components/landing/landing-challenges").then((m) => ({
      default: m.LandingChallenges,
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
  const router = useRouter();
  const [goalId, setGoalId] = useState<string | null>(null);
  const [dockVisible, setDockVisible] = useState(false);
  const ctaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const node = ctaRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setDockVisible(!entry.isIntersecting),
      { threshold: 0.2 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const continueToPlan = useCallback(() => {
    const option = LANDING_MAIN_GOALS.find((goal) => goal.id === goalId);
    if (option) {
      const draft = loadIntakeDraft() ?? {};
      saveIntakeDraft({ ...draft, goal: option.intakeGoal });
    }
    router.push(GET_STARTED_HREF);
  }, [goalId, router]);

  return (
    <div className="landing-page relative flex min-h-dvh flex-col pb-24">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <Image
          src={LANDING_BACKGROUND_IMAGE}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/35 to-background/65" />
      </div>

      <div className="relative">
        <LandingNav overlay ctaLabel={LANDING_PLAN_CTA} onCta={continueToPlan} />
        <LandingHero
          goalId={goalId}
          onGoalChange={setGoalId}
          onContinue={continueToPlan}
          ctaRef={ctaRef}
        />
      </div>
      <main className="flex-1">
        <LandingTransformations />
        <LandingCoachAlex />
        <LandingHowItWorks />
        <LandingAppPreview />
        <LandingShowcase />
        <LandingChallenges />
        <LandingFounderBio />
        <LandingPricing />
        <LandingReviews />
        <LandingCta onContinue={continueToPlan} />
      </main>
      <LandingStickyCta goalId={goalId} visible={dockVisible} onContinue={continueToPlan} />
    </div>
  );
}
