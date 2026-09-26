"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native-app";
import { IOS_ONBOARDING_PATH } from "@/lib/ios-routes";

/**
 * Native-only: incomplete intake → dedicated iOS onboarding (not the web home wizard).
 * No-ops on the website so ClientIntakeForm remains the web path.
 */
export function NativeIncompleteIntakeGate({
  intakeComplete,
}: {
  intakeComplete: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    if (intakeComplete) return;
    router.replace(IOS_ONBOARDING_PATH);
  }, [intakeComplete, router]);

  return null;
}
