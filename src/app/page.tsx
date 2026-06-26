import type { Metadata } from "next";
import { LandingPageClient } from "@/components/landing/landing-page";
import { LandingJsonLd } from "@/components/landing/landing-json-ld";
import { LandingFooter } from "@/components/landing/landing-footer";
import { SITE_URL } from "@/lib/landing-content";
import { PLATFORM_NAME } from "@/lib/brand";
import { getCachedAllPerEur } from "@/lib/exchange-rates";

export const metadata: Metadata = {
  title: `${PLATFORM_NAME} — Workouts, Nutrition & AI Coaching`,
  description:
    "Premium fitness platform with workout builder, nutrition tracking, AI coach, and live coaching. From €19/month.",
  keywords: [
    "fitness app",
    "workout tracker",
    "nutrition tracking",
    "AI coach",
    "personal training",
    "meal logging",
    "live coaching",
  ],
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: PLATFORM_NAME,
    title: `${PLATFORM_NAME} — Workouts, Nutrition & AI Coaching`,
    description:
      "Train smarter with workouts, nutrition, AI coaching, and live sessions in one premium dashboard.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${PLATFORM_NAME} — Workouts, Nutrition & AI Coaching`,
    description:
      "Premium fitness platform with AI meal logging, live coaching, and custom trainer plans.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

/** Auth redirect for logged-in users is handled in proxy.ts — keep this page static for fast TTFB. */
export default async function HomePage() {
  const allPerEur = await getCachedAllPerEur();

  return (
    <>
      <LandingJsonLd />
      <LandingPageClient allPerEur={allPerEur} />
      <LandingFooter />
    </>
  );
}
