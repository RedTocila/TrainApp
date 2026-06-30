export type UnitSystem = "metric" | "imperial";

const KG_PER_LB = 0.45359237;
const CM_PER_FT = 30.48;

const MAX_WEIGHT_KG = 500;
const MAX_HEIGHT_CM = 280;
const MIN_HEIGHT_CM = 50;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function cmToFt(cm: number): number {
  return cm / CM_PER_FT;
}

export function ftToCm(ft: number): number {
  return ft * CM_PER_FT;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function weightUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "imperial" ? "lb" : "kg";
}

export function heightUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "imperial" ? "ft" : "cm";
}

/** Format a canonical kg value for display in the user's unit system. */
export function formatWeightFromKg(kg: number, unitSystem: UnitSystem): string {
  if (unitSystem === "imperial") {
    return roundTo(kgToLb(kg), 1).toFixed(1);
  }
  return roundTo(kg, 1).toFixed(1);
}

export function formatWeightWithUnitFromKg(
  kg: number,
  unitSystem: UnitSystem
): string {
  return `${formatWeightFromKg(kg, unitSystem)} ${weightUnitLabel(unitSystem)}`;
}

/** Parse user weight input into canonical kg for storage. */
export function parseWeightToKg(
  raw: string,
  unitSystem: UnitSystem
): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  const kg = unitSystem === "imperial" ? lbToKg(parsed) : parsed;
  if (kg > MAX_WEIGHT_KG) return null;
  return roundTo(kg, 2);
}

export function maxWeightInput(unitSystem: UnitSystem): number {
  return unitSystem === "imperial" ? roundTo(kgToLb(MAX_WEIGHT_KG), 1) : MAX_WEIGHT_KG;
}

export function weightInputPlaceholder(unitSystem: UnitSystem): string {
  return unitSystem === "imperial" ? "e.g. 165" : "e.g. 75.5";
}

/** Format a canonical cm value for display in the user's unit system. */
export function formatHeightFromCm(cm: number, unitSystem: UnitSystem): string {
  if (unitSystem === "imperial") {
    return roundTo(cmToFt(cm), 2).toFixed(2);
  }
  return String(Math.round(cm));
}

export function formatHeightWithUnitFromCm(
  cm: number,
  unitSystem: UnitSystem
): string {
  return `${formatHeightFromCm(cm, unitSystem)} ${heightUnitLabel(unitSystem)}`;
}

/** Parse user height input into canonical cm for storage. */
export function parseHeightToCm(
  raw: string,
  unitSystem: UnitSystem
): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  const cm = unitSystem === "imperial" ? ftToCm(parsed) : parsed;
  if (cm < MIN_HEIGHT_CM || cm > MAX_HEIGHT_CM) return null;
  return Math.round(cm);
}

export function heightInputPlaceholder(unitSystem: UnitSystem): string {
  return unitSystem === "imperial" ? "e.g. 5.75" : "e.g. 175";
}

export function weightLabel(unitSystem: UnitSystem): string {
  return unitSystem === "imperial" ? "Weight (lb)" : "Weight (kg)";
}

export function heightLabel(unitSystem: UnitSystem): string {
  return unitSystem === "imperial" ? "Height (ft)" : "Height (cm)";
}
