import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPageClient } from "@/components/landing/landing-page";
import { LandingJsonLd } from "@/components/landing/landing-json-ld";
import { SITE_URL } from "@/lib/landing-content";

export const metadata: Metadata = {
  title: "TrainApp — Workouts, Nutrition & AI Coaching",
  description:
    "Premium fitness platform with workout builder, nutrition tracking, AI coach, live coaching sessions, and custom trainer plans. Start free — plans from €7/month.",
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
    siteName: "TrainApp",
    title: "TrainApp — Workouts, Nutrition & AI Coaching",
    description:
      "Train smarter with workouts, nutrition, AI coaching, and live sessions in one premium dashboard.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrainApp — Workouts, Nutrition & AI Coaching",
    description:
      "Premium fitness platform with AI meal logging, live coaching, and custom trainer plans.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    redirect(profile?.role === "admin" ? "/admin" : "/dashboard");
  }

  return (
    <>
      <LandingJsonLd />
      <LandingPageClient />
    </>
  );
}
