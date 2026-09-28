"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { NATIVE_APP_COOKIE } from "@/lib/native-app-request";

type PullToRefreshBridge = {
  postMessage: (message: { enabled: boolean }) => void;
};

/**
 * Pauses the iOS shell's pull-to-refresh while a sheet locks page scroll or a
 * screen opts out with `data-native-pull-refresh="off"` (e.g. active workouts).
 */
function syncNativePullToRefresh(): () => void {
  const bridge = (
    window as Window & {
      webkit?: { messageHandlers?: { rutinaPullToRefresh?: PullToRefreshBridge } };
    }
  ).webkit?.messageHandlers?.rutinaPullToRefresh;
  if (!bridge) return () => undefined;

  let lastEnabled: boolean | null = null;
  let frame: number | null = null;

  const report = () => {
    frame = null;
    const enabled =
      !document.documentElement.classList.contains("body-scroll-locked") &&
      !document.querySelector('[data-native-pull-refresh="off"]');
    if (enabled === lastEnabled) return;
    lastEnabled = enabled;
    bridge.postMessage({ enabled });
  };

  const schedule = () => {
    if (frame == null) frame = requestAnimationFrame(report);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-native-pull-refresh"],
  });
  report();

  return () => {
    observer.disconnect();
    if (frame != null) cancelAnimationFrame(frame);
  };
}

/**
 * Native-only polish: status bar + splash + deep-link resume into the WebView.
 * No-ops on the regular website.
 */
export function NativeAppBootstrap() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    return syncNativePullToRefresh();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    document.cookie = `${NATIVE_APP_COOKIE}=1; path=/; max-age=31536000; secure; samesite=lax`;

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
