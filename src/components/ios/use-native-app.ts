"use client";

import { useSyncExternalStore } from "react";
import { hidesChallengesInApp, isFreeNativeApp, isNativeApp } from "@/lib/native-app";
import { shouldUseAppleIap } from "@/lib/native-iap";

const subscribe = () => () => {};

/** Capacitor is unavailable during SSR — server snapshot is always "website". */
export function useIsFreeNativeApp(): boolean {
  return useSyncExternalStore(subscribe, isFreeNativeApp, () => false);
}

export function useHidesChallengesInApp(): boolean {
  return useSyncExternalStore(subscribe, hidesChallengesInApp, () => false);
}

export function useIsNativeApp(): boolean {
  return useSyncExternalStore(subscribe, isNativeApp, () => false);
}

/** SSR-safe Apple IAP flag — false on server / first paint, then native value. */
export function useShouldUseAppleIap(): boolean {
  return useSyncExternalStore(subscribe, shouldUseAppleIap, () => false);
}
