import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import { reminderDeepLinkPath, type ReminderType } from "@/lib/reminder-settings";

export type ReminderPushMessage = {
  title: string;
  body: string;
  path: string;
};

function joinLabels(labels: string[], andWord: string): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} ${andWord} ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} ${andWord} ${labels[labels.length - 1]}`;
}

/** One notification listing whatever is still open. A single type uses its own copy. */
export function reminderPushMessage(
  types: ReminderType[],
  locale: CheckoutLocale
): ReminderPushMessage {
  const copy = getPlatformCopy(locale).reminders;
  if (types.length === 1) {
    const type = types[0];
    return {
      title: copy.notifTitles[type],
      body: copy.notifBodies[type],
      path: reminderDeepLinkPath(type),
    };
  }
  const labels = types.map((type) => copy.shortTypes[type]);
  return {
    title: copy.digestTitle,
    body: copy.digestStillOpen(joinLabels(labels, copy.digestAnd)),
    path: "/dashboard",
  };
}
