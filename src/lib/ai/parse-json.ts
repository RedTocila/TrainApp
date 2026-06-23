export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

export function parseJsonObject<T extends Record<string, unknown>>(raw: string): T {
  return JSON.parse(extractJsonText(raw)) as T;
}

export function clampConfidence(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.7;
  return Math.min(1, Math.max(0, Math.round(num * 1000) / 1000));
}

export function roundMacro(value: unknown): number {
  return Math.round(Number(value) || 0);
}
