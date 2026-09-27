"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ensureAppFreeAccess } from "@/lib/actions/app-access";
import { isFreeNativeApp } from "@/lib/native-app";

/** Native-only: unlock everything for signed-in users of the free app. No-op on the website. */
export function NativeAppAccessSync() {
  const router = useRouter();

  useEffect(() => {
    if (!isFreeNativeApp()) return;
    let cancelled = false;
    void ensureAppFreeAccess()
      .then(({ granted }) => {
        if (granted && !cancelled) router.refresh();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
