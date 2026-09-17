"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Native-only polish: status bar + splash + deep-link resume into the WebView.
 * No-ops on the regular website.
 */
export function NativeAppBootstrap() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeUrlListener: (() => void) | undefined;
    let cancelled = false;

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
          await StatusBar.setBackgroundColor({ color: "#121214" }).catch(
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

            const path =
              parsed.protocol === "rutina:"
                ? `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`
                : `${parsed.pathname}${parsed.search}${parsed.hash}`;
            const normalized = path.startsWith("/") ? path : `/${path}`;
            const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            if (normalized && normalized !== current) {
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
