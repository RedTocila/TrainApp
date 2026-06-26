/** Turn API / server-action errors into safe user-facing strings (never `{}`). */
export function formatUserError(value: unknown, fallback = "Something went wrong. Please try again."): string {
  if (value == null) return fallback;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "{}") return fallback;
    return trimmed;
  }

  if (value instanceof Error) {
    const trimmed = value.message.trim();
    return trimmed && trimmed !== "{}" ? trimmed : fallback;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.message === "string") {
      const trimmed = record.message.trim();
      if (trimmed && trimmed !== "{}") return trimmed;
    }
    if (typeof record.error === "string") {
      const trimmed = record.error.trim();
      if (trimmed && trimmed !== "{}") return trimmed;
    }
  }

  return fallback;
}
