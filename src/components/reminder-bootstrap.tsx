"use client";

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { usePlatformCopy } from "@/components/locale-provider";
import {
  getReminderSettings,
  getTodayReminderPendingStatus,
} from "@/lib/actions/reminders";
import {
  buildReminderCopy,
  syncReminderNotifications,
} from "@/lib/native-reminders";
import { onReminderDone } from "@/lib/reminder-events";
import { reminderDeepLinkPath, type ReminderType } from "@/lib/reminder-settings";

/**
 * On native: keep local reminder notifications in sync with settings + today's completion.
 * Handles notification taps (deep-link into the relevant dashboard section).
 */
export function ReminderBootstrap() {
  const platform = usePlatformCopy();
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
        const timezoneOffsetMinutes = new Date().getTimezoneOffset();
        const [settings, pendingToday] = await Promise.all([
          getReminderSettings(),
          getTodayReminderPendingStatus(timezoneOffsetMinutes),
        ]);
        if (cancelled) return;
        await syncReminderNotifications({
          settings,
          pendingToday,
          copy: buildReminderCopy(platform),
        });
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
            const extra = event.notification.extra as
              | { type?: ReminderType; path?: string }
              | undefined;
            const path =
              extra?.path ??
              (extra?.type ? reminderDeepLinkPath(extra.type) : "/dashboard");
            const current = `${window.location.pathname}${window.location.search}`;
            if (path && path !== current) {
              window.location.assign(path);
            }
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
        // Plugins unavailable
      }
    })();

    return () => {
      cancelled = true;
      removeAction?.();
      removeResume?.();
      removeDone?.();
    };
  }, [platform]);

  return null;
}
