export const REMINDER_TYPES = [
  "workout",
  "meals",
  "cardio",
  "water",
  "habits",
] as const;

export type ReminderType = (typeof REMINDER_TYPES)[number];

export type ReminderTypeConfig = {
  enabled: boolean;
  /** Local wall-clock time `HH:MM` */
  time: string;
};

export type ReminderSettings = {
  enabled: boolean;
  workout: ReminderTypeConfig;
  meals: ReminderTypeConfig;
  cardio: ReminderTypeConfig;
  water: ReminderTypeConfig;
  habits: ReminderTypeConfig;
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  workout: { enabled: true, time: "18:00" },
  meals: { enabled: true, time: "19:00" },
  cardio: { enabled: true, time: "17:00" },
  water: { enabled: true, time: "19:30" },
  habits: { enabled: true, time: "20:00" },
};

/** Stable numeric ids for Capacitor Local Notifications (type × 100 + day offset). */
export const REMINDER_NOTIFICATION_BASE: Record<ReminderType, number> = {
  workout: 1100,
  meals: 1200,
  cardio: 1300,
  water: 1400,
  habits: 1500,
};

export const REMINDER_SCHEDULE_DAYS = 14;

export function reminderNotificationId(
  type: ReminderType,
  dayOffset: number
): number {
  return REMINDER_NOTIFICATION_BASE[type] + dayOffset;
}

export function allReminderNotificationIds(): number[] {
  const ids: number[] = [];
  for (const type of REMINDER_TYPES) {
    for (let i = 0; i < REMINDER_SCHEDULE_DAYS; i++) {
      ids.push(reminderNotificationId(type, i));
    }
  }
  return ids;
}

function isTimeString(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value.slice(0, 5));
}

function normalizeTime(value: unknown, fallback: string): string {
  if (!isTimeString(value)) return fallback;
  return value.slice(0, 5);
}

function normalizeTypeConfig(
  raw: unknown,
  fallback: ReminderTypeConfig
): ReminderTypeConfig {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const obj = raw as Record<string, unknown>;
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : fallback.enabled,
    time: normalizeTime(obj.time, fallback.time),
  };
}

export function parseReminderSettings(raw: unknown): ReminderSettings {
  if (!raw || typeof raw !== "object") {
    return structuredClone(DEFAULT_REMINDER_SETTINGS);
  }
  const obj = raw as Record<string, unknown>;
  return {
    enabled:
      typeof obj.enabled === "boolean"
        ? obj.enabled
        : DEFAULT_REMINDER_SETTINGS.enabled,
    workout: normalizeTypeConfig(obj.workout, DEFAULT_REMINDER_SETTINGS.workout),
    meals: normalizeTypeConfig(obj.meals, DEFAULT_REMINDER_SETTINGS.meals),
    cardio: normalizeTypeConfig(obj.cardio, DEFAULT_REMINDER_SETTINGS.cardio),
    water: normalizeTypeConfig(obj.water, DEFAULT_REMINDER_SETTINGS.water),
    habits: normalizeTypeConfig(obj.habits, DEFAULT_REMINDER_SETTINGS.habits),
  };
}

export function reminderDeepLinkPath(type: ReminderType): string {
  switch (type) {
    case "workout":
      return "/dashboard/workout/schedule";
    case "cardio":
      return "/dashboard/workout/cardio";
    case "meals":
    case "water":
      return "/dashboard/nutrition";
    case "habits":
      return "/dashboard";
    default:
      return "/dashboard";
  }
}
