"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { IOS_WELCOME_PATH, isIosAppPath } from "@/lib/ios-routes";

/**
 * Native-only polish: status bar + splash + deep-link resume into the WebView.
 * Also routes cold starts away from the marketing landing (web `/` stays unchanged).
 * No-ops on the regular website.
 */
export function NativeAppBootstrap() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeUrlListener: (() => void) | undefined;
    let cancelled = false;

    const path = window.location.pathname;
    // Logged-out native users hitting marketing home → native welcome.
    // Never redirects browser/web traffic.
    if (path === "/" || path === "") {
      window.location.replace(IOS_WELCOME_PATH);
      return;
    }
    // Optional: send native users who open the web get-started funnel into iOS onboarding.
    if (path === "/get-started") {
      window.location.replace("/ios/onboarding");
      return;
    }

    void (async () => {
      try {
        const [{ StatusBar, Style }, { SplashScreen }, { App }] =
          await Promise.all([
            import("@capacitor/status-bar"),
            import("@capacitor/splash-screen"),
            import("@capacitor/app"),
          ]);

        if (cancelled) return;

        await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
        if (Capacitor.getPlatform() === "android") {
          await StatusBar.setBackgroundColor({ color: "#0c0c0e" }).catch(
            () => undefined,
          );
        }
        await SplashScreen.hide().catch(() => undefined);

        const handle = await App.addListener("appUrlOpen", ({ url }) => {
          try {
            const parsed = new URL(url);
            const isOurs =
              parsed.hostname === "rutina.al" ||
              parsed.hostname === "www.rutina.al" ||
              parsed.protocol === "rutina:";
            if (!isOurs) return;

            const deepPath =
              parsed.protocol === "rutina:"
                ? `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`
                : `${parsed.pathname}${parsed.search}${parsed.hash}`;
            const normalized = deepPath.startsWith("/")
              ? deepPath
              : `/${deepPath}`;
            const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            if (normalized && normalized !== current) {
              // Prefer native welcome over marketing home for deep links to `/`.
              if (normalized === "/" || normalized.startsWith("/?")) {
                window.location.assign(IOS_WELCOME_PATH);
                return;
              }
              window.location.assign(normalized);
            }
          } catch {
            // ignore malformed deep links
          }
        });

        removeUrlListener = () => {
          void handle.remove();
        };
      } catch {
        // Plugins unavailable in unsupported environments
      }
    })();

    return () => {
      cancelled = true;
      removeUrlListener?.();
    };
  }, []);

  return null;
}

/** True when the current path belongs to the native funnel (client-only helper). */
export function isOnIosFunnelPath(pathname: string): boolean {
  return isIosAppPath(pathname);
}
