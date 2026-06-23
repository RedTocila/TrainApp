import { addDays, addWeeks, format, startOfWeek } from "date-fns";

export type ScheduleStartMode = "now" | "next_week";

export interface InferredSchedule {
  dayId: string;
  weekdays: number[];
  weeks: number;
  startMode: ScheduleStartMode;
  upcomingCount: number;
}

export function inferScheduleFromSessions(
  sessions: { scheduled_date: string; day_id: string }[]
): InferredSchedule | null {
  if (sessions.length === 0) return null;

  const weekdays = [
    ...new Set(
      sessions.map((s) => new Date(s.scheduled_date + "T12:00:00").getDay())
    ),
  ].sort((a, b) => a - b);

  const dayCounts = new Map<string, number>();
  for (const session of sessions) {
    dayCounts.set(session.day_id, (dayCounts.get(session.day_id) ?? 0) + 1);
  }
  const dayId = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const firstDate = new Date(sessions[0].scheduled_date + "T12:00:00");
  const lastDate = new Date(
    sessions[sessions.length - 1].scheduled_date + "T12:00:00"
  );
  const weekStartFirst = startOfWeek(firstDate, { weekStartsOn: 1 });
  const weekStartLast = startOfWeek(lastDate, { weekStartsOn: 1 });
  const weeks = Math.max(
    1,
    Math.round(
      (weekStartLast.getTime() - weekStartFirst.getTime()) /
        (7 * 24 * 60 * 60 * 1000)
    ) + 1
  );

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const startMode: ScheduleStartMode =
    sessions[0].scheduled_date <= todayKey ? "now" : "next_week";

  return {
    dayId,
    weekdays,
    weeks,
    startMode,
    upcomingCount: sessions.length,
  };
}

export function getScheduleAnchorDate(mode: ScheduleStartMode): Date {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (mode === "now") return today;
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  return addWeeks(thisWeekStart, 1);
}

export function formatScheduleAnchorLabel(mode: ScheduleStartMode): string {
  const anchor = getScheduleAnchorDate(mode);
  if (mode === "now") return `Starting today (${format(anchor, "MMM d")})`;
  return `Starting next week (${format(anchor, "MMM d")})`;
}

/** 0 = Sunday, 1 = Monday, ... 6 = Saturday (matches JS Date.getDay()) */
export const WEEKDAY_OPTIONS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
] as const;

/** Monday-based offset within the week: Mon=0 … Sun=6 */
function weekdayToOffset(dayOfWeek: number): number {
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
}

export function generateRecurringScheduleDates(
  anchor: Date,
  weekdays: number[],
  weeks: number
): string[] {
  if (weekdays.length === 0 || weeks < 1) return [];

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const anchorKey = format(anchor, "yyyy-MM-dd");
  const dates = new Set<string>();

  for (let week = 0; week < weeks; week++) {
    for (const dayOfWeek of weekdays) {
      const date = addDays(addWeeks(weekStart, week), weekdayToOffset(dayOfWeek));
      const key = format(date, "yyyy-MM-dd");
      if (key >= anchorKey) {
        dates.add(key);
      }
    }
  }

  return [...dates].sort();
}

export function describeSchedulePreview(
  anchor: Date,
  weekdays: number[],
  weeks: number
): string {
  const dates = generateRecurringScheduleDates(anchor, weekdays, weeks);
  if (dates.length === 0) return "Select at least one day and one week.";

  const first = dates[0];
  const last = dates[dates.length - 1];

  return `${dates.length} session${dates.length === 1 ? "" : "s"} · ${format(new Date(first + "T12:00:00"), "MMM d")} – ${format(new Date(last + "T12:00:00"), "MMM d, yyyy")}`;
}
