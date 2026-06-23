import type { ClientCardio, ScheduledCardio } from "@/lib/types";

export function scheduledCardioByDateMap(
  entries: ScheduledCardio[]
): Record<string, ClientCardio> {
  const map: Record<string, ClientCardio> = {};
  for (const entry of entries) {
    const cardio = entry.client_cardio;
    if (cardio) {
      map[entry.scheduled_date] = cardio;
    }
  }
  return map;
}
