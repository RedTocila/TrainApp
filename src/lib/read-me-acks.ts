import { parseReminderSettings, type ReminderSettings } from "@/lib/reminder-settings";

export type ReadMeAckBlob = {
  coach?: boolean;
  progressPhotos?: boolean;
  coachAt?: string;
  progressPhotosAt?: string;
};

export function readMeFromSettings(raw: unknown): ReadMeAckBlob {
  if (!raw || typeof raw !== "object") return {};
  const blob = (raw as Record<string, unknown>)._read_me;
  if (!blob || typeof blob !== "object") return {};
  return blob as ReadMeAckBlob;
}

/** Merge reminder fields while preserving extras like `_read_me`. */
export function mergeReminderSettingsJson(
  existing: unknown,
  nextReminders: ReminderSettings
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object"
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return {
    ...base,
    ...nextReminders,
  };
}

export function withReadMeAck(
  existing: unknown,
  patch: Partial<ReadMeAckBlob>
): Record<string, unknown> {
  const reminders = parseReminderSettings(existing);
  const next = mergeReminderSettingsJson(existing, reminders);
  next._read_me = {
    ...readMeFromSettings(existing),
    ...patch,
  };
  return next;
}
