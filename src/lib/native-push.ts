import { Capacitor } from "@capacitor/core";
import {
  getPushDeliveryReady,
  registerPushDevice,
} from "@/lib/actions/push-devices";

type PushPlatform = "ios" | "android";

export type PushRegisterResult = {
  pluginAvailable: boolean;
  permissionGranted: boolean;
  deliveryReady: boolean;
};

let listening = false;

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function openPath(path: string | undefined) {
  if (!path || path === currentPath()) return;
  window.location.assign(path);
}

/** Listen for the device token and for taps. Safe to call more than once. */
export async function listenForReminderPushes(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || listening) return listening;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    listening = true;
    const platform: PushPlatform =
      Capacitor.getPlatform() === "ios" ? "ios" : "android";

    await PushNotifications.addListener("registration", (token) => {
      void registerPushDevice(token.value, platform);
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
      const data = event.notification.data as { path?: string } | undefined;
      openPath(data?.path);
    });
    return true;
  } catch {
    listening = false;
    return false;
  }
}

export async function registerReminderPush(): Promise<PushRegisterResult> {
  if (!Capacitor.isNativePlatform()) {
    return { pluginAvailable: false, permissionGranted: false, deliveryReady: false };
  }

  const available = await listenForReminderPushes();
  if (!available) {
    return { pluginAvailable: false, permissionGranted: false, deliveryReady: false };
  }

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const platform: PushPlatform =
      Capacitor.getPlatform() === "ios" ? "ios" : "android";
    let status = await PushNotifications.checkPermissions();
    if (status.receive !== "granted") {
      status = await PushNotifications.requestPermissions();
    }
    if (status.receive !== "granted") {
      return { pluginAvailable: true, permissionGranted: false, deliveryReady: false };
    }

    if (platform === "android") {
      await PushNotifications.createChannel({
        id: "reminders",
        name: "Daily reminders",
        description: "Nudges when workouts, meals, water, or habits are still pending",
        importance: 4,
        visibility: 1,
        sound: "default",
        vibration: true,
      }).catch(() => undefined);
    }

    await PushNotifications.register();
    const ready = await getPushDeliveryReady();
    return {
      pluginAvailable: true,
      permissionGranted: true,
      deliveryReady: platform === "ios" ? ready.ios : ready.android,
    };
  } catch {
    return { pluginAvailable: false, permissionGranted: false, deliveryReady: false };
  }
}
