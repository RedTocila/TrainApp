"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hidesChallengesInApp, isFreeNativeApp } from "@/lib/native-app";
import { isChallengePath, isPaidOnlyPath } from "@/lib/ios-routes";

/** Native-only: send screens that are hidden in the app back to Home. No-op on the website. */
export function NativeRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const blocked =
      (isFreeNativeApp() && isPaidOnlyPath(pathname)) ||
      (hidesChallengesInApp() && isChallengePath(pathname));
    if (blocked) router.replace("/dashboard");
  }, [pathname, router]);

  return null;
}
