export const ACCENT_COLORS = [
  { id: "red", label: "Red", swatch: "#dc2626" },
  { id: "purple", label: "Purple", swatch: "#9333ea" },
  { id: "pink", label: "Pink", swatch: "#db2777" },
  { id: "teal", label: "Teal", swatch: "#0d9488" },
  { id: "blue", label: "Blue", swatch: "#2563eb" },
  { id: "neon", label: "Neon", swatch: "#22c55e" },
  { id: "black", label: "Black", swatch: "#171717" },
  { id: "yellow", label: "Yellow", swatch: "#eab308" },
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number]["id"];

export type AccentPaletteEntry = {
  primary: string;
  accent: string;
  rgb: string;
  primaryForeground?: string;
  dark?: {
    primary: string;
    accent: string;
    rgb: string;
    primaryForeground?: string;
  };
};

export const ACCENT_PALETTE: Record<AccentColor, AccentPaletteEntry> = {
  red: { primary: "#dc2626", accent: "#ef4444", rgb: "220, 38, 38" },
  purple: { primary: "#9333ea", accent: "#a855f7", rgb: "147, 51, 234" },
  pink: { primary: "#db2777", accent: "#f472b6", rgb: "219, 39, 119" },
  teal: { primary: "#0d9488", accent: "#2dd4bf", rgb: "13, 148, 136" },
  blue: { primary: "#2563eb", accent: "#60a5fa", rgb: "37, 99, 235" },
  neon: { primary: "#16a34a", accent: "#4ade80", rgb: "34, 197, 94" },
  black: {
    primary: "#262626",
    accent: "#525252",
    rgb: "38, 38, 38",
    dark: {
      primary: "#e4e4e7",
      accent: "#fafafa",
      rgb: "228, 228, 231",
      primaryForeground: "#18181b",
    },
  },
  yellow: { primary: "#eab308", accent: "#facc15", rgb: "234, 179, 8" },
};

export function resolveAccentPalette(
  color: AccentColor,
  theme: "dark" | "light"
): Omit<AccentPaletteEntry, "dark"> {
  const palette = ACCENT_PALETTE[color];
  if (theme === "dark" && palette.dark) {
    return palette.dark;
  }
  return {
    primary: palette.primary,
    accent: palette.accent,
    rgb: palette.rgb,
    primaryForeground: palette.primaryForeground,
  };
}

export function isAccentColor(value: string | null): value is AccentColor {
  return ACCENT_COLORS.some((c) => c.id === value);
}

/** Maps legacy stored accent ids to current palette keys. */
export function normalizeAccentColor(value: string | null): AccentColor {
  if (value === "amber") return "purple";
  return isAccentColor(value) ? value : "red";
}
