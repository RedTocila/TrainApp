/** Daytime checks in Albania local time. Users do not pick these. */
export const REMINDER_PUSH_HOURS = [11, 16, 20] as const;

export const REMINDER_TIMEZONE = "Europe/Tirane";

export type ReminderSlot = 1 | 2 | 3;

export function reminderSlotForHour(hour: number): ReminderSlot | null {
  if (hour === REMINDER_PUSH_HOURS[0]) return 1;
  if (hour === REMINDER_PUSH_HOURS[1]) return 2;
  if (hour === REMINDER_PUSH_HOURS[2]) return 3;
  return null;
}

export function tiraneClock(at: Date = new Date()): {
  dateKey: string;
  hour: number;
  weekday: number;
} {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: REMINDER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(at).map((part) => [part.type, part.value])
  );
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour);
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return {
    dateKey,
    hour: Number.isFinite(hour) ? hour : 0,
    weekday,
  };
}
