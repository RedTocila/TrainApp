export const ACCENT_COLORS = [
  { id: "red", label: "Red", swatch: "#dc2626" },
  { id: "amber", label: "Amber", swatch: "#d97706" },
  { id: "pink", label: "Pink", swatch: "#db2777" },
  { id: "teal", label: "Teal", swatch: "#0d9488" },
  { id: "blue", label: "Blue", swatch: "#2563eb" },
  { id: "neon", label: "Neon", swatch: "#22c55e" },
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number]["id"];

export const ACCENT_PALETTE: Record<
  AccentColor,
  { primary: string; accent: string; rgb: string }
> = {
  red: { primary: "#dc2626", accent: "#ef4444", rgb: "220, 38, 38" },
  amber: { primary: "#d97706", accent: "#fbbf24", rgb: "217, 119, 6" },
  pink: { primary: "#db2777", accent: "#f472b6", rgb: "219, 39, 119" },
  teal: { primary: "#0d9488", accent: "#2dd4bf", rgb: "13, 148, 136" },
  blue: { primary: "#2563eb", accent: "#60a5fa", rgb: "37, 99, 235" },
  neon: { primary: "#16a34a", accent: "#4ade80", rgb: "34, 197, 94" },
};

export function isAccentColor(value: string | null): value is AccentColor {
  return ACCENT_COLORS.some((c) => c.id === value);
}
