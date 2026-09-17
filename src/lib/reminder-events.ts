import type { ReminderType } from "@/lib/reminder-settings";

const EVENT = "rutina:reminder-completed";

/** Call after the user completes a tracked daily item (workout, meal, etc.). */
export function markReminderDone(type: ReminderType): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(EVENT, { detail: { type } satisfies { type: ReminderType } })
  );
}

export function onReminderDone(
  handler: (type: ReminderType) => void
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ type?: ReminderType }>).detail;
    if (detail?.type) handler(detail.type);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
