import type { Metadata } from "next";
import { IosWelcomeClient } from "@/components/ios/ios-welcome-client";

export const metadata: Metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
};

export default function IosWelcomePage() {
  return <IosWelcomeClient />;
}
