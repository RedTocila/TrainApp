import { Capacitor } from "@capacitor/core";
import type { CheckoutLocale } from "@/lib/checkout-i18n";
import type { ReminderDayStatus } from "@/lib/actions/reminders";
import { REMINDER_PUSH_HOURS, type ReminderSlot } from "@/lib/reminder-clock";
import { reminderPushMessage } from "@/lib/reminder-message";
import { reminderDaySplit } from "@/lib/reminder-pending";
import { getPlatformCopy } from "@/lib/platform-copy";
import {
  allReminderNotificationIds,
  REMINDER_SLOT_NOTIFICATION_IDS,
  type ReminderSettings,
} from "@/lib/reminder-settings";

async function getLocalNotifications() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

export async function ensureReminderPermissions(channel?: {
  name: string;
  description: string;
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  }

  try {
    const LocalNotifications = await getLocalNotifications();
    let status = await LocalNotifications.checkPermissions();
    if (status.display !== "granted") {
      status = await LocalNotifications.requestPermissions();
    }
    if (status.display === "granted" && Capacitor.getPlatform() === "android") {
      await LocalNotifications.createChannel({
        id: "reminders",
        name: channel?.name ?? "Daily reminders",
        description:
          channel?.description ??
          "Nudges when workouts, meals, water, or habits are pending",
        importance: 4,
        visibility: 1,
        sound: "default",
        vibration: true,
      }).catch(() => undefined);
    }
    return status.display === "granted";
  } catch {
    return false;
  }
}

export async function cancelAllReminderNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const LocalNotifications = await getLocalNotifications();
    const ids = allReminderNotificationIds().map((id) => ({ id }));
    await LocalNotifications.cancel({ notifications: ids });
  } catch {
    // ignore
  }
}

/**
 * Local fallback for today: 11:00, 16:00, 20:00, and 23:00 if nothing is done.
 * Remote push replaces this once the server can deliver to this platform.
 */
export async function syncTodaySlotReminders(options: {
  settings: ReminderSettings;
  today: ReminderDayStatus;
  locale: CheckoutLocale;
}): Promise<{ scheduled: number; permissionGranted: boolean }> {
  if (!Capacitor.isNativePlatform()) {
    return { scheduled: 0, permissionGranted: false };
  }

  await cancelAllReminderNotifications();

  if (!options.settings.enabled) {
    return { scheduled: 0, permissionGranted: true };
  }

  const progress = reminderDaySplit({
    settings: options.settings,
    due: options.today.due,
    open: options.today.open,
  });
  if (progress.open.length === 0) {
    return { scheduled: 0, permissionGranted: true };
  }

  const copy = getPlatformCopy(options.locale).reminders;
  const granted = await ensureReminderPermissions({
    name: copy.channelName,
    description: copy.channelDescription,
  });
  if (!granted) {
    return { scheduled: 0, permissionGranted: false };
  }

  const LocalNotifications = await getLocalNotifications();
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const notifications: {
    id: number;
    title: string;
    body: string;
    schedule: { at: Date; allowWhileIdle: boolean };
    extra: { path: string };
    channelId?: string;
  }[] = [];

  REMINDER_PUSH_HOURS.forEach((hour, index) => {
    const slot = (index + 1) as ReminderSlot;
    if (slot === 4 && progress.done.length > 0) return;
    const at = new Date();
    at.setHours(hour, 0, 0, 0);
    if (at.getTime() <= now.getTime() + 15_000) return;
    const message = reminderPushMessage({
      open: progress.open,
      done: progress.done,
      locale: options.locale,
      slot,
      seed: `${dateKey}:${slot}`,
    });
    if (!message) return;
    notifications.push({
      id: REMINDER_SLOT_NOTIFICATION_IDS[index]!,
      title: message.title,
      body: message.body,
      schedule: { at, allowWhileIdle: true },
      extra: { path: message.path },
      ...(Capacitor.getPlatform() === "android" ? { channelId: "reminders" } : {}),
    });
  });

  if (notifications.length === 0) {
    return { scheduled: 0, permissionGranted: true };
  }

  await LocalNotifications.schedule({ notifications });
  return { scheduled: notifications.length, permissionGranted: true };
}
