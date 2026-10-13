import type { Metadata } from "next";
import { IosGeneratingClient } from "@/components/ios/ios-generating-client";

export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Building your RUTINA",
  robots: { index: false, follow: false },
};

export default function IosGeneratingPage() {
  return <IosGeneratingClient />;
}
