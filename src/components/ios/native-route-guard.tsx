"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hidesChallengesInApp, isFreeNativeApp, isNativeApp } from "@/lib/native-app";
import {
  IOS_WELCOME_PATH,
  isChallengePath,
  isIosAppPath,
  isPaidOnlyPath,
} from "@/lib/ios-routes";

/** Native-only: send screens that are hidden in the app elsewhere. No-op on the website. */
export function NativeRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    // The marketing landing lists packages; logged-in users are sent on to /dashboard by the proxy.
    if (pathname === "/") {
      router.replace(IOS_WELCOME_PATH);
      return;
    }
    const blocked =
      (isIosAppPath(pathname) && pathname !== IOS_WELCOME_PATH) ||
      (isFreeNativeApp() && isPaidOnlyPath(pathname)) ||
      (hidesChallengesInApp() && isChallengePath(pathname));
    if (blocked) router.replace("/dashboard");
  }, [pathname, router]);

  return null;
}
