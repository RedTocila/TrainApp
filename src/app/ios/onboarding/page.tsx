import type { Metadata } from "next";
import { IosOnboardingClient } from "@/components/ios/ios-onboarding-client";

export const metadata: Metadata = {
  title: "Onboarding",
  robots: { index: false, follow: false },
};

export default function IosOnboardingPage() {
  return <IosOnboardingClient />;
}
