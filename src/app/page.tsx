import type { Metadata } from "next";
import { LandingPageClient } from "@/components/landing/landing-page";
import { LandingJsonLd } from "@/components/landing/landing-json-ld";
import { LandingFooter } from "@/components/landing/landing-footer";
import { SITE_URL } from "@/lib/landing-content";
import { PLATFORM_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${PLATFORM_NAME} — Workouts and meals that adjust as you do`,
  description:
    "Answer a two-minute questionnaire about your goal, equipment and schedule. RUTINA builds your plan, and Coach Alex keeps you on it.",
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
    title: `${PLATFORM_NAME} — Workouts and meals that adjust as you do`,
    description:
      "Answer a two-minute questionnaire about your goal, equipment and schedule. RUTINA builds your plan, and Coach Alex keeps you on it.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${PLATFORM_NAME} — Workouts and meals that adjust as you do`,
    description:
      "Answer a two-minute questionnaire about your goal, equipment and schedule. RUTINA builds your plan, and Coach Alex keeps you on it.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

/** Auth redirect for logged-in users is handled in proxy.ts — keep this page static for fast TTFB. */
export default function HomePage() {
  return (
    <>
      <LandingJsonLd />
      <div className="pb-6">
        <LandingPageClient />
        <LandingFooter />
      </div>
    </>
  );
}
