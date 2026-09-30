const MAX_WEIGHT_KG = 500;
const MAX_HEIGHT_CM = 280;
const MIN_HEIGHT_CM = 50;

export const WEIGHT_UNIT = "kg";
export const HEIGHT_UNIT = "cm";
export const WEIGHT_LABEL = "Weight (kg)";
export const HEIGHT_LABEL = "Height (cm)";
export const WEIGHT_INPUT_PLACEHOLDER = "e.g. 75.5";
export const HEIGHT_INPUT_PLACEHOLDER = "e.g. 175";
export const MAX_WEIGHT_INPUT = MAX_WEIGHT_KG;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Accept `75.5` and locale decimal commas like `75,5` before parsing. */
export function normalizeDecimalInput(raw: string): string {
  return raw.trim().replace(/\s/g, "").replace(",", ".");
}

function parseDecimalNumber(raw: string): number | null {
  const normalized = normalizeDecimalInput(raw);
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function trimTrailingZeros(value: number, maxDecimals: number): string {
  return value.toFixed(maxDecimals).replace(/\.?0+$/, "");
}

export function formatWeightFromKg(kg: number): string {
  return roundTo(kg, 1).toFixed(1);
}

/** Format weight for free-form input fields (no forced decimal places). */
export function formatWeightFromKgForInput(kg: number): string {
  return trimTrailingZeros(roundTo(kg, 1), 1);
}

export function formatWeightWithUnitFromKg(kg: number): string {
  return `${formatWeightFromKg(kg)} ${WEIGHT_UNIT}`;
}

/** Parse user weight input into kg for storage. */
export function parseWeightToKg(raw: string): number | null {
  const kg = parseDecimalNumber(raw);
  if (kg == null || kg > MAX_WEIGHT_KG) return null;
  return roundTo(kg, 2);
}

export function formatHeightFromCm(cm: number): string {
  return String(Math.round(cm));
}

export function formatHeightWithUnitFromCm(cm: number): string {
  return `${formatHeightFromCm(cm)} ${HEIGHT_UNIT}`;
}

/** Parse user height input into cm for storage. */
export function parseHeightToCm(raw: string): number | null {
  const cm = parseDecimalNumber(raw);
  if (cm == null || cm < MIN_HEIGHT_CM || cm > MAX_HEIGHT_CM) return null;
  return Math.round(cm);
}
