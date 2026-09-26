import type { Metadata } from "next";
import { IosGeneratingClient } from "@/components/ios/ios-generating-client";

export const metadata: Metadata = {
  title: "Building your RUTINA",
  robots: { index: false, follow: false },
};

export default function IosGeneratingPage() {
  return <IosGeneratingClient />;
}
