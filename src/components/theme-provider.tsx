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

type Theme = "dark";
const DEFAULT_THEME: Theme = "dark";
const DEFAULT_ACCENT: AccentColor = "red";
const THEME_KEY = "theme";
const ACCENT_KEY = "accent-color";

interface ThemeContextValue {
  theme: Theme;
  /** App is dark-only; kept for API compatibility. */
  setTheme: (theme: "dark" | "light") => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyDarkTheme() {
  document.documentElement.classList.add("dark");
  document.documentElement.classList.remove("light");
}

function applyAccentColor(color: AccentColor) {
  const palette = resolveAccentPalette(color, "dark");
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

function persistDarkTheme(userId?: string | null) {
  localStorage.setItem(THEME_KEY, DEFAULT_THEME);
  if (userId) {
    localStorage.setItem(getScopedKey(THEME_KEY, userId), DEFAULT_THEME);
  }
}

function persistAccent(accentColor: AccentColor, userId?: string | null) {
  localStorage.setItem(ACCENT_KEY, accentColor);
  if (userId) {
    localStorage.setItem(getScopedKey(ACCENT_KEY, userId), accentColor);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accentColor, setAccentColorState] = useState<AccentColor>(DEFAULT_ACCENT);
  const [userId, setUserId] = useState<string | null>(null);

  useLayoutEffect(() => {
    applyDarkTheme();
    persistDarkTheme();
    const storedAccent = readStoredAccent();
    applyAccentColor(storedAccent);
    setAccentColorState(storedAccent);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const applyForUser = (nextUserId: string | null) => {
      if (!active) return;
      setUserId(nextUserId);

      applyDarkTheme();
      persistDarkTheme(nextUserId);

      if (!nextUserId) {
        applyAccentColor(DEFAULT_ACCENT);
        setAccentColorState(DEFAULT_ACCENT);
        persistAccent(DEFAULT_ACCENT);
        return;
      }

      const nextAccent = readStoredAccent(nextUserId);
      applyAccentColor(nextAccent);
      setAccentColorState(nextAccent);
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

  const setTheme = useCallback((_next: "dark" | "light") => {
    applyDarkTheme();
    persistDarkTheme(userId);
    applyAccentColor(accentColor);
  }, [accentColor, userId]);

  const setAccentColor = useCallback(
    (next: AccentColor) => {
      setAccentColorState(next);
      persistAccent(next, userId);
      applyAccentColor(next);
    },
    [userId]
  );

  return (
    <ThemeContext.Provider
      value={{
        theme: DEFAULT_THEME,
        setTheme,
        accentColor,
        setAccentColor,
      }}
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
