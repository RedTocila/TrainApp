"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import {
  type AccentColor,
  normalizeAccentColor,
  resolveAccentPalette,
} from "@/lib/theme-colors";
import { createClient } from "@/lib/supabase/client";

type Theme = "dark" | "light";
const DEFAULT_THEME: Theme = "dark";
const DEFAULT_ACCENT: AccentColor = "red";
const THEME_KEY = "theme";
const ACCENT_KEY = "accent-color";

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

function getScopedKey(key: string, userId: string) {
  return `${key}:${userId}`;
}

function readStoredTheme(userId?: string | null): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = userId
    ? localStorage.getItem(getScopedKey(THEME_KEY, userId))
    : localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function readInitialTheme(): Theme {
  return readStoredTheme();
}

function readStoredAccent(userId?: string | null): AccentColor {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  const stored = userId
    ? localStorage.getItem(getScopedKey(ACCENT_KEY, userId))
    : localStorage.getItem(ACCENT_KEY);
  const normalized = normalizeAccentColor(stored);
  if (stored === "amber") {
    if (userId) {
      localStorage.setItem(getScopedKey(ACCENT_KEY, userId), "purple");
    }
    localStorage.setItem(ACCENT_KEY, "purple");
  }
  return normalized;
}

function persistTheme(theme: Theme, userId?: string | null) {
  localStorage.setItem(THEME_KEY, theme);
  if (userId) {
    localStorage.setItem(getScopedKey(THEME_KEY, userId), theme);
  }
}

function persistAccent(accentColor: AccentColor, userId?: string | null) {
  localStorage.setItem(ACCENT_KEY, accentColor);
  if (userId) {
    localStorage.setItem(getScopedKey(ACCENT_KEY, userId), accentColor);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [accentColor, setAccentColorState] = useState<AccentColor>(DEFAULT_ACCENT);
  const [userId, setUserId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const storedTheme = readStoredTheme();
    const storedAccent = readStoredAccent();
    applyTheme(storedTheme);
    applyAccentColor(storedAccent, storedTheme);
    setThemeState(storedTheme);
    setAccentColorState(storedAccent);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const applyForUser = (nextUserId: string | null) => {
      if (!active) return;
      setUserId(nextUserId);

      if (!nextUserId) {
        applyTheme(DEFAULT_THEME);
        applyAccentColor(DEFAULT_ACCENT, DEFAULT_THEME);
        setThemeState(DEFAULT_THEME);
        setAccentColorState(DEFAULT_ACCENT);
        persistTheme(DEFAULT_THEME);
        persistAccent(DEFAULT_ACCENT);
        return;
      }

      const nextTheme = readStoredTheme(nextUserId);
      const nextAccent = readStoredAccent(nextUserId);
      applyTheme(nextTheme);
      applyAccentColor(nextAccent, nextTheme);
      setThemeState(nextTheme);
      setAccentColorState(nextAccent);
      persistTheme(nextTheme, nextUserId);
      persistAccent(nextAccent, nextUserId);
    };

    supabase.auth.getUser().then(({ data }) => {
      applyForUser(data.user?.id ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      applyForUser(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      persistTheme(next, userId);
      applyTheme(next);
      applyAccentColor(accentColor, next);
    },
    [accentColor, userId]
  );

  const setAccentColor = useCallback(
    (next: AccentColor) => {
      setAccentColorState(next);
      persistAccent(next, userId);
      applyAccentColor(next, theme);
    },
    [theme, userId]
  );

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
