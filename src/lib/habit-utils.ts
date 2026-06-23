import { formatDateKey } from "@/lib/utils";

export function formatTimeValue(time: string | null | undefined): string {
  if (!time) return "";
  return time.slice(0, 5);
}

export function formatHabitTimeWindow(
  timeStart: string | null | undefined,
  timeEnd: string | null | undefined
): string | undefined {
  const start = formatTimeValue(timeStart);
  const end = formatTimeValue(timeEnd);
  if (start && end) return `${start} – ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return undefined;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
}

export type HabitWindowPhase = "upcoming" | "active" | "missed";

export function getHabitWindowPhase(
  habit: { time_start?: string | null; time_end?: string | null },
  dateKey: string,
  now: Date = new Date()
): HabitWindowPhase {
  const todayKey = formatDateKey(now);

  if (dateKey < todayKey) return "missed";
  if (dateKey > todayKey) return "upcoming";

  const start = habit.time_start ? formatTimeValue(habit.time_start) : null;
  const end = habit.time_end ? formatTimeValue(habit.time_end) : null;

  if (!start && !end) return "active";

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (start && nowMinutes < parseTimeToMinutes(start)) return "upcoming";
  if (end && nowMinutes > parseTimeToMinutes(end)) return "missed";

  return "active";
}

export type HabitDayStatus = "completed" | "missed" | "upcoming" | "available";

export function getHabitDayStatus(
  habit: { time_start?: string | null; time_end?: string | null },
  dateKey: string,
  completed: boolean,
  now: Date = new Date()
): HabitDayStatus {
  if (completed) return "completed";

  const phase = getHabitWindowPhase(habit, dateKey, now);
  if (phase === "missed") return "missed";
  if (phase === "upcoming") return "upcoming";
  return "available";
}

export function canCompleteHabit(
  _habit: { time_start?: string | null; time_end?: string | null },
  dateKey: string,
  completed: boolean,
  now: Date = new Date()
): boolean {
  if (completed) return false;
  return dateKey === formatDateKey(now);
}

export function habitStatusLabel(
  status: HabitDayStatus,
  habit: { time_start?: string | null; time_end?: string | null }
): string | undefined {
  if (status === "missed") return "Missed";
  if (status === "upcoming") {
    const start = formatTimeValue(habit.time_start);
    return start ? `Starts at ${start}` : "Upcoming";
  }
  return undefined;
}
