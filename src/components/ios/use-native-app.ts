"use client";

import { useSyncExternalStore } from "react";
import { hidesChallengesInApp, isFreeNativeApp } from "@/lib/native-app";

const subscribe = () => () => {};

/** Capacitor is unavailable during SSR — server snapshot is always "website". */
export function useIsFreeNativeApp(): boolean {
  return useSyncExternalStore(subscribe, isFreeNativeApp, () => false);
}

export function useHidesChallengesInApp(): boolean {
  return useSyncExternalStore(subscribe, hidesChallengesInApp, () => false);
}
