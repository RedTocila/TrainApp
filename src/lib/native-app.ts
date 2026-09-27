import { Capacitor } from "@capacitor/core";
import { NATIVE_APP_FREE, NATIVE_HIDE_CHALLENGES } from "@/lib/app-free-access";

/** True when running inside the iOS/Android Capacitor shell. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getNativePlatform(): "ios" | "android" | "web" {
  const platform = Capacitor.getPlatform();
  if (platform === "ios" || platform === "android") return platform;
  return "web";
}

/** Native shell running as a free app (packages, payments and upsells hidden). */
export function isFreeNativeApp(): boolean {
  return NATIVE_APP_FREE && isNativeApp();
}

/** Native shell with challenges hidden (live classes only). */
export function hidesChallengesInApp(): boolean {
  return NATIVE_HIDE_CHALLENGES && isNativeApp();
}
