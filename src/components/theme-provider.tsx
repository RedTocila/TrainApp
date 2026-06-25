"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import {
  type AccentColor,
  isAccentColor,
  resolveAccentPalette,
} from "@/lib/theme-colors";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function applyAccentColor(color: AccentColor, theme: Theme = readInitialTheme()) {
  const palette = resolveAccentPalette(color, theme);
  const root = document.documentElement;
  root.dataset.accent = color;
  root.style.setProperty("--primary", palette.primary);
  root.style.setProperty("--accent", palette.accent);
  root.style.setProperty("--ring", palette.primary);
  root.style.setProperty("--primary-rgb", palette.rgb);
  if (palette.primaryForeground) {
    root.style.setProperty("--primary-foreground", palette.primaryForeground);
  } else {
    root.style.removeProperty("--primary-foreground");
  }
}

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function readInitialAccent(): AccentColor {
  if (typeof window === "undefined") return "red";
  const stored = localStorage.getItem("accent-color");
  return isAccentColor(stored) ? stored : "red";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);
  const [accentColor, setAccentColorState] = useState<AccentColor>(readInitialAccent);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
    const storedAccent = localStorage.getItem("accent-color");
    applyAccentColor(isAccentColor(storedAccent) ? storedAccent : "red", next);
  }, []);

  const setAccentColor = useCallback((next: AccentColor) => {
    setAccentColorState(next);
    localStorage.setItem("accent-color", next);
    const theme = document.documentElement.classList.contains("light")
      ? "light"
      : "dark";
    applyAccentColor(next, theme);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, accentColor, setAccentColor }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
