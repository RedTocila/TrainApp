"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { NATIVE_APP_COOKIE } from "@/lib/native-app-request";
import { createClient } from "@/lib/supabase/client";
import { endLiveWorkoutIfIdle, flushLiveWorkoutLogs } from "@/lib/live-workout";
import { subscribeWorkoutMirror, syncWatchSession } from "@/lib/watch-session";

type PullToRefreshBridge = {
  postMessage: (message: { enabled?: boolean; done?: boolean }) => void;
};

type RutinaWindow = Window & {
  __rutinaSoftRefresh?: () => void;
};

/** Run after the first screen paints. Falls back when idle callbacks are missing. */
function whenIdle(work: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(work, { timeout: 1200 });
    return () => cancelIdleCallback(id);
  }
  const id = window.setTimeout(work, 300);
  return () => window.clearTimeout(id);
}

function nodeOptsOutOfPullRefresh(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  if (node.getAttribute("data-native-pull-refresh") === "off") return true;
  return node.querySelector('[data-native-pull-refresh="off"]') != null;
}

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

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        const isLock =
          record.attributeName === "class" && record.target === document.documentElement;
        if (isLock || record.attributeName === "data-native-pull-refresh") {
          schedule();
          return;
        }
        continue;
      }
      const nodes = [...record.addedNodes, ...record.removedNodes];
      if (nodes.some(nodeOptsOutOfPullRefresh)) {
        schedule();
        return;
      }
    }
  });
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
 * Native-only polish: status bar + deep-link resume into the WebView.
 * The launch splash is dismissed by the boot script once the first screen is in the HTML.
 * No-ops on the regular website.
 */
export function NativeAppBootstrap() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const refresh = () => {
      router.refresh();
    };
    (window as RutinaWindow).__rutinaSoftRefresh = refresh;
    return () => {
      if ((window as RutinaWindow).__rutinaSoftRefresh === refresh) {
        delete (window as RutinaWindow).__rutinaSoftRefresh;
      }
    };
  }, [router]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let stop = () => {};
    const cancelIdle = whenIdle(() => {
      stop = syncNativePullToRefresh();
    });
    return () => {
      cancelIdle();
      stop();
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    document.cookie = `${NATIVE_APP_COOKIE}=1; path=/; max-age=31536000; secure; samesite=lax`;

    let stopMirror = () => {};
    let unsubscribeAuth = () => {};
    let removeUrlListener: (() => void) | undefined;
    let removeStateListener: (() => void) | undefined;
    let cancelled = false;

    const cancelIdle = whenIdle(() => {
      if (cancelled) return;
      void flushLiveWorkoutLogs();
      void syncWatchSession();
      void endLiveWorkoutIfIdle();

      stopMirror = subscribeWorkoutMirror((event) => {
        if (event.action !== "start") return;
        void (async () => {
          const { getInProgressSession } = await import("@/lib/actions/workout-sessions");
          for (let attempt = 0; attempt < 8; attempt += 1) {
            const live = await getInProgressSession();
            if (live?.id) {
              const path = `/dashboard/workout/session/${live.id}`;
              if (!window.location.pathname.startsWith(path)) {
                window.location.assign(path);
              }
              return;
            }
            await new Promise((resolve) => window.setTimeout(resolve, 350));
          }
        })();
      });

      const supabase = createClient();
      const { data: authListener } = supabase.auth.onAuthStateChange(() => {
        void syncWatchSession();
      });
      unsubscribeAuth = () => authListener.subscription.unsubscribe();

      void (async () => {
        try {
          const [{ StatusBar, Style }, { App }] = await Promise.all([
            import("@capacitor/status-bar"),
            import("@capacitor/app"),
          ]);

          if (cancelled) return;

          await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
          if (Capacitor.getPlatform() === "android") {
            await StatusBar.setBackgroundColor({ color: "#0c0c0e" }).catch(
              () => undefined,
            );
          }

          const openDeepLink = (url: string) => {
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
              const alreadyInWorkout =
                normalized.startsWith("/dashboard/workout/live") &&
                window.location.pathname.startsWith("/dashboard/workout/session/");
              if (normalized && normalized !== current && !alreadyInWorkout) {
                window.location.assign(normalized);
              }
            } catch {
              // ignore malformed deep links
            }
          };

          const stateHandle = await App.addListener("appStateChange", ({ isActive }) => {
            if (!isActive) return;
            void flushLiveWorkoutLogs();
            void syncWatchSession();
            void endLiveWorkoutIfIdle();
          });
          removeStateListener = () => {
            void stateHandle.remove();
          };

          const handle = await App.addListener("appUrlOpen", ({ url }) => {
            openDeepLink(url);
          });
          const launch = await App.getLaunchUrl();
          if (launch?.url) openDeepLink(launch.url);

          removeUrlListener = () => {
            void handle.remove();
          };
        } catch {
          // Plugins unavailable in unsupported environments
        }
      })();
    });

    return () => {
      cancelled = true;
      cancelIdle();
      stopMirror();
      unsubscribeAuth();
      removeStateListener?.();
      removeUrlListener?.();
    };
  }, []);

  return null;
}
