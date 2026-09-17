import { Capacitor } from "@capacitor/core";

/** True when running inside the iOS/Android Capacitor shell. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getNativePlatform(): "ios" | "android" | "web" {
  const platform = Capacitor.getPlatform();
  if (platform === "ios" || platform === "android") return platform;
  return "web";
}
