import { Capacitor } from "@capacitor/core";
import {
  allReminderNotificationIds,
  parseReminderSettings,
  reminderDeepLinkPath,
  reminderNotificationId,
  REMINDER_SCHEDULE_DAYS,
  REMINDER_TYPES,
  type ReminderSettings,
  type ReminderType,
} from "@/lib/reminder-settings";

export type ReminderCopy = {
  channelName: string;
  channelDescription: string;
  titles: Record<ReminderType, string>;
  bodies: Record<ReminderType, string>;
};

function parseHourMinute(time: string): { hour: number; minute: number } {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return {
    hour: Number.isFinite(h) ? h : 0,
    minute: Number.isFinite(m) ? m : 0,
  };
}

function atLocalTime(base: Date, hour: number, minute: number): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function getLocalNotifications() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

export async function ensureReminderPermissions(): Promise<boolean> {
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
        name: "Daily reminders",
        description: "Nudges when workouts, meals, water, or habits are pending",
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

export async function cancelReminderTypeForToday(
  type: ReminderType
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const LocalNotifications = await getLocalNotifications();
    await LocalNotifications.cancel({
      notifications: [{ id: reminderNotificationId(type, 0) }],
    });
  } catch {
    // ignore
  }
}

/**
 * Schedule local notifications for the next N days.
 * Today is skipped for a type when it is already done or the reminder time passed.
 */
export async function syncReminderNotifications(options: {
  settings: ReminderSettings;
  pendingToday: Record<ReminderType, boolean>;
  copy: ReminderCopy;
}): Promise<{ scheduled: number; permissionGranted: boolean }> {
  const settings = parseReminderSettings(options.settings);

  if (!Capacitor.isNativePlatform()) {
    return { scheduled: 0, permissionGranted: false };
  }

  await cancelAllReminderNotifications();

  if (!settings.enabled) {
    return { scheduled: 0, permissionGranted: true };
  }

  const granted = await ensureReminderPermissions();
  if (!granted) {
    return { scheduled: 0, permissionGranted: false };
  }

  const LocalNotifications = await getLocalNotifications();
  const now = new Date();
  const notifications: {
    id: number;
    title: string;
    body: string;
    schedule: { at: Date; allowWhileIdle: boolean };
    extra: { type: ReminderType; path: string };
    channelId?: string;
  }[] = [];

  for (const type of REMINDER_TYPES) {
    const config = settings[type];
    if (!config.enabled) continue;

    const { hour, minute } = parseHourMinute(config.time);
    for (let dayOffset = 0; dayOffset < REMINDER_SCHEDULE_DAYS; dayOffset++) {
      const day = addDays(now, dayOffset);
      const at = atLocalTime(day, hour, minute);

      if (at.getTime() <= now.getTime() + 15_000) continue;
      if (dayOffset === 0 && !options.pendingToday[type]) continue;

      notifications.push({
        id: reminderNotificationId(type, dayOffset),
        title: options.copy.titles[type],
        body: options.copy.bodies[type],
        schedule: { at, allowWhileIdle: true },
        extra: { type, path: reminderDeepLinkPath(type) },
        ...(Capacitor.getPlatform() === "android"
          ? { channelId: "reminders" }
          : {}),
      });
    }
  }

  if (notifications.length === 0) {
    return { scheduled: 0, permissionGranted: true };
  }

  await LocalNotifications.schedule({ notifications });
  return { scheduled: notifications.length, permissionGranted: true };
}

export function buildReminderCopy(platform: {
  reminders: {
    notifTitles: Record<ReminderType, string>;
    notifBodies: Record<ReminderType, string>;
    channelName: string;
    channelDescription: string;
  };
}): ReminderCopy {
  return {
    channelName: platform.reminders.channelName,
    channelDescription: platform.reminders.channelDescription,
    titles: platform.reminders.notifTitles,
    bodies: platform.reminders.notifBodies,
  };
}
