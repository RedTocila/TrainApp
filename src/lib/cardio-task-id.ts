export function cardioTaskId(
  dateKey: string,
  cardioId?: string | null
): string {
  if (cardioId) {
    return `${dateKey}-cardio-${cardioId}`;
  }
  return `${dateKey}-cardio`;
}

export function isCardioTaskId(taskId: string): boolean {
  return /-cardio(?:-|$)/.test(taskId);
}

/** Match any cardio completion task id for a given calendar day. */
export function isCardioTaskIdForDate(taskId: string, dateKey: string): boolean {
  return (
    taskId === `${dateKey}-cardio` || taskId.startsWith(`${dateKey}-cardio-`)
  );
}
