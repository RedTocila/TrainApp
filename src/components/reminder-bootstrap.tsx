"use client";

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useLocale } from "@/components/locale-provider";
import { getReminderSettings } from "@/lib/actions/reminders";
import { syncReminderDelivery } from "@/lib/reminder-delivery";
import { onReminderDone } from "@/lib/reminder-events";

/**
 * On the native app, register reminder push and keep a local fallback in sync.
 * Notification taps open the dashboard section named in the payload.
 */
export function ReminderBootstrap() {
  const locale = useLocale();
  const syncing = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let removeAction: (() => void) | undefined;
    let removeResume: (() => void) | undefined;
    let removeDone: (() => void) | undefined;

    const sync = async () => {
      if (cancelled || syncing.current) return;
      syncing.current = true;
      try {
        const settings = await getReminderSettings();
        if (cancelled) return;
        await syncReminderDelivery(settings, locale);
      } catch {
        // ignore sync failures (offline / permissions)
      } finally {
        syncing.current = false;
      }
    };

    removeDone = onReminderDone(() => {
      void sync();
    });

    void (async () => {
      try {
        const [{ LocalNotifications }, { App }] = await Promise.all([
          import("@capacitor/local-notifications"),
          import("@capacitor/app"),
        ]);
        if (cancelled) return;

        const actionHandle = await LocalNotifications.addListener(
          "localNotificationActionPerformed",
          (event) => {
            const extra = event.notification.extra as { path?: string } | undefined;
            const path = extra?.path ?? "/dashboard";
            const current = `${window.location.pathname}${window.location.search}`;
            if (path !== current) window.location.assign(path);
          }
        );
        removeAction = () => {
          void actionHandle.remove();
        };

        const resumeHandle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) void sync();
        });
        removeResume = () => {
          void resumeHandle.remove();
        };

        await sync();
      } catch {
        // Plugin unavailable
      }
    })();

    return () => {
      cancelled = true;
      removeAction?.();
      removeResume?.();
      removeDone?.();
    };
  }, [locale]);

  return null;
}
