"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Capacitor } from "@capacitor/core";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { PLATFORM_NAME } from "@/lib/brand";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "rutina_pwa_install_dismissed";
/** Install banner is paused. Set true to show “Instalo RUTINA” again. */
const SHOW_INSTALL_BANNER = false;

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIosBrowser(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isMobileBrowser(): boolean {
  if (isIosBrowser()) return true;
  if (/Android|Mobile/i.test(navigator.userAgent)) return true;
  return window.matchMedia("(max-width: 767px)").matches;
}

export function PwaRegister() {
  const locale = useLocale();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [showBanner, setShowBanner] = useState(false);
  const [manualHint, setManualHint] = useState<string | null>(null);

  const copy =
    locale === "en"
      ? {
          title: `Install ${PLATFORM_NAME}`,
          body: "Open it like an app on your phone",
          dismiss: "No",
          install: "Install",
          iosHint: "Tap Share, then Add to Home Screen.",
          otherHint: "Open the browser menu, then Install app or Add to Home screen.",
        }
      : {
          title: `Instalo ${PLATFORM_NAME}`,
          body: "Hapeni si app në telefonin tuaj",
          dismiss: "Jo",
          install: "Instalo",
          iosHint: "Trokit Share, pastaj Shto në ekranin kryesor.",
          otherHint: "Hap menunë e shfletuesit, pastaj Instalo ose Shto në ekranin kryesor.",
        };

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Native shell already is an app — skip SW registration there.
    if (Capacitor.isNativePlatform()) return;
    // Dev + Turbopack: a controlling SW commonly surfaces as TypeError "Failed to fetch".
    if (process.env.NODE_ENV !== "production") {
      void (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((reg) => reg.unregister()));
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
          }
        } catch {
          // ignore
        }
      })();
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    if (!SHOW_INSTALL_BANNER) return;
    if (Capacitor.isNativePlatform()) return;
    if (isStandaloneDisplay()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    // Phones never get that event in Safari, and often not in mobile Chrome.
    // Show the same banner there anyway.
    if (isMobileBrowser()) setShowBanner(true);

    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!SHOW_INSTALL_BANNER || !showBanner) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--dashboard-mobile-nav-height,4.75rem)+0.75rem)] z-[110] flex justify-center px-4 lg:bottom-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-border/60 bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {copy.title}
          </p>
          <p className={manualHint ? "text-xs text-muted-foreground" : "truncate text-xs text-muted-foreground"}>
            {manualHint ?? copy.body}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="shrink-0"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setShowBanner(false);
          }}
        >
          {copy.dismiss}
        </Button>
        <Button
          type="button"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={async () => {
            if (!deferred) {
              setManualHint(isIosBrowser() ? copy.iosHint : copy.otherHint);
              return;
            }
            await deferred.prompt();
            const choice = await deferred.userChoice;
            if (choice.outcome === "accepted") {
              localStorage.setItem(DISMISS_KEY, "1");
            }
            setDeferred(null);
            setShowBanner(false);
          }}
        >
          <Download className="size-3.5" aria-hidden />
          {copy.install}
        </Button>
      </div>
    </div>
  );
}
