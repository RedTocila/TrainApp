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

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PwaRegister() {
  const locale = useLocale();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [showBanner, setShowBanner] = useState(false);

  const copy =
    locale === "en"
      ? {
          title: `Install ${PLATFORM_NAME}`,
          body: "Open it like an app on your phone",
          dismiss: "No",
          install: "Install",
        }
      : {
          title: `Instalo ${PLATFORM_NAME}`,
          body: "Hapeni si app në telefonin tuaj",
          dismiss: "Jo",
          install: "Instalo",
        };

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Native shell already is an app — skip SW registration there.
    if (Capacitor.isNativePlatform()) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (isStandaloneDisplay()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!showBanner || !deferred) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-border/60 bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {copy.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">{copy.body}</p>
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
