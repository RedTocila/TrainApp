"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hidesChallengesInApp, isFreeNativeApp, isNativeApp } from "@/lib/native-app";
import { isChallengePath, isIosAppPath, isPaidOnlyPath } from "@/lib/ios-routes";

/** Native-only: send screens that are hidden in the app elsewhere. No-op on the website. */
export function NativeRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    // The marketing landing lists packages; logged-in users are sent on to /dashboard by the proxy.
    if (pathname === "/") {
      router.replace("/login");
      return;
    }
    const blocked =
      isIosAppPath(pathname) ||
      (isFreeNativeApp() && isPaidOnlyPath(pathname)) ||
      (hidesChallengesInApp() && isChallengePath(pathname));
    if (blocked) router.replace("/dashboard");
  }, [pathname, router]);

  return null;
}
