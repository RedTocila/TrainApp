"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ACCENT_PALETTE,
  type AccentColor,
  isAccentColor,
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

function applyAccentColor(color: AccentColor) {
  const palette = ACCENT_PALETTE[color];
  const root = document.documentElement;
  root.dataset.accent = color;
  root.style.setProperty("--primary", palette.primary);
  root.style.setProperty("--accent", palette.accent);
  root.style.setProperty("--ring", palette.primary);
  root.style.setProperty("--primary-rgb", palette.rgb);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [accentColor, setAccentColorState] = useState<AccentColor>("red");

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    const initialTheme = storedTheme === "light" ? "light" : "dark";
    setThemeState(initialTheme);
    applyTheme(initialTheme);

    const storedAccent = localStorage.getItem("accent-color");
    const initialAccent = isAccentColor(storedAccent) ? storedAccent : "red";
    setAccentColorState(initialAccent);
    applyAccentColor(initialAccent);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
  }, []);

  const setAccentColor = useCallback((next: AccentColor) => {
    setAccentColorState(next);
    localStorage.setItem("accent-color", next);
    applyAccentColor(next);
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
