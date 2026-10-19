import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { getTodayReminderPendingStatus } from "@/lib/actions/reminders";
import { Capacitor } from "@capacitor/core";
import {
  cancelAllReminderNotifications,
  syncTodaySlotReminders,
} from "@/lib/native-reminders";
import { registerReminderPush } from "@/lib/native-push";
import type { ReminderSettings } from "@/lib/reminder-settings";

/**
 * Register for remote push when the server can send it.
 * Otherwise schedule today's three local slots for whatever is still open.
 */
export async function syncReminderDelivery(
  settings: ReminderSettings,
  locale: CheckoutLocale
): Promise<{ permissionGranted: boolean }> {
  if (!Capacitor.isNativePlatform()) {
    return { permissionGranted: false };
  }

  if (!settings.enabled) {
    await cancelAllReminderNotifications();
    return { permissionGranted: true };
  }

  const push = await registerReminderPush();
  if (push.pluginAvailable && !push.permissionGranted) {
    return { permissionGranted: false };
  }
  if (push.deliveryReady) {
    await cancelAllReminderNotifications();
    return { permissionGranted: true };
  }

  const today = await getTodayReminderPendingStatus(
    new Date().getTimezoneOffset()
  );
  const local = await syncTodaySlotReminders({
    settings,
    today,
    locale,
  });
  return { permissionGranted: local.permissionGranted };
}
