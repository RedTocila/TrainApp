import type { ClientCardio, ScheduledCardio } from "@/lib/types";

export type ScheduledCardioSummary = {
  id: string;
  title: string;
  duration_minutes?: number | null;
};

/** Map calendar dates → scheduled cardio summaries (ordered). */
export function scheduledCardioByDateMap(
  entries: ScheduledCardio[]
): Record<string, ScheduledCardioSummary[]> {
  const map: Record<string, ScheduledCardioSummary[]> = {};
  const sorted = [...entries].sort(
    (a, b) =>
      (a.order_index ?? 0) - (b.order_index ?? 0) ||
      (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
      a.id.localeCompare(b.id)
  );

  for (const entry of sorted) {
    const cardio = entry.client_cardio;
    if (!cardio) continue;
    const list = map[entry.scheduled_date] ?? [];
    list.push({
      id: cardio.id,
      title: cardio.title,
      duration_minutes: cardio.duration_minutes,
    });
    map[entry.scheduled_date] = list;
  }
  return map;
}

export function sortScheduledCardios(
  entries: ScheduledCardio[]
): ScheduledCardio[] {
  return [...entries].sort(
    (a, b) =>
      (a.order_index ?? 0) - (b.order_index ?? 0) ||
      (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
      a.id.localeCompare(b.id)
  );
}

export function scheduledCardiosForDate(
  entries: ScheduledCardio[] | undefined,
  dateKey: string
): ScheduledCardio[] {
  if (!entries?.length) return [];
  return sortScheduledCardios(
    entries.filter((entry) => entry.scheduled_date === dateKey)
  );
}

/** Prefer non-completed cardio when selecting a default slide. */
export function pickDefaultCardioIndex(
  entries: ScheduledCardio[],
  isCompleted: (entry: ScheduledCardio) => boolean
): number {
  if (entries.length === 0) return 0;
  const firstOpen = entries.findIndex((entry) => !isCompleted(entry));
  return firstOpen >= 0 ? firstOpen : 0;
}
