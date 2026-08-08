import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DashboardCardTheme =
  | "workout"
  | "nutrition"
  | "water"
  | "cardio"
  | "bmi"
  | "weight"
  | "habits"
  | "lifestyle"
  | "photos";

const THEME: Record<
  DashboardCardTheme,
  {
    from: string;
    radial: string;
    blur: string;
    accent: string;
    border: string;
  }
> = {
  workout: {
    from: "from-primary/42 dark:from-primary/58",
    radial: "rgba(var(--primary-rgb),0.50)",
    blur: "bg-primary/30 dark:bg-primary/28",
    accent: "text-primary",
    border: "border-primary/35 dark:border-primary/25",
  },
  nutrition: {
    from: "from-emerald-500/38 dark:from-emerald-500/54",
    radial: "rgba(16,185,129,0.50)",
    blur: "bg-emerald-400/30 dark:bg-emerald-400/28",
    accent: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/40 dark:border-emerald-500/30",
  },
  water: {
    from: "from-sky-400/40 dark:from-sky-400/56",
    radial: "rgba(56,189,248,0.52)",
    blur: "bg-sky-300/35 dark:bg-sky-300/30",
    accent: "text-sky-700 dark:text-sky-300",
    border: "border-sky-500/40 dark:border-sky-500/30",
  },
  cardio: {
    from: "from-orange-500/38 dark:from-orange-500/54",
    radial: "rgba(249,115,22,0.50)",
    blur: "bg-orange-400/30 dark:bg-orange-400/28",
    accent: "text-orange-700 dark:text-orange-300",
    border: "border-orange-500/40 dark:border-orange-500/30",
  },
  bmi: {
    from: "from-yellow-400/40 dark:from-yellow-400/52",
    radial: "rgba(250,204,21,0.50)",
    blur: "bg-yellow-300/32 dark:bg-yellow-300/28",
    accent: "text-yellow-800 dark:text-yellow-300",
    border: "border-yellow-500/40 dark:border-yellow-500/30",
  },
  weight: {
    from: "from-teal-500/38 dark:from-teal-500/54",
    radial: "rgba(20,184,166,0.50)",
    blur: "bg-teal-400/30 dark:bg-teal-400/28",
    accent: "text-teal-800 dark:text-teal-300",
    border: "border-teal-500/40 dark:border-teal-500/30",
  },
  habits: {
    from: "from-violet-500/38 dark:from-violet-500/54",
    radial: "rgba(139,92,246,0.50)",
    blur: "bg-violet-400/30 dark:bg-violet-400/28",
    accent: "text-violet-700 dark:text-violet-300",
    border: "border-violet-500/40 dark:border-violet-500/30",
  },
  lifestyle: {
    from: "from-rose-500/38 dark:from-rose-500/52",
    radial: "rgba(244,63,94,0.50)",
    blur: "bg-rose-400/30 dark:bg-rose-400/28",
    accent: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/40 dark:border-rose-500/30",
  },
  photos: {
    from: "from-fuchsia-500/38 dark:from-fuchsia-500/52",
    radial: "rgba(217,70,239,0.50)",
    blur: "bg-fuchsia-400/30 dark:bg-fuchsia-400/28",
    accent: "text-fuchsia-700 dark:text-fuchsia-300",
    border: "border-fuchsia-500/40 dark:border-fuchsia-500/30",
  },
};

export function dashboardThemeAccent(theme: DashboardCardTheme) {
  return THEME[theme].accent;
}

/**
 * Shared dashboard card shell — colored gradient atmosphere that works in
 * light and dark mode (no flat black fills; text uses theme foreground).
 */
export function DashboardThemedShell({
  theme,
  className,
  children,
  id,
}: {
  theme: DashboardCardTheme;
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  const t = THEME[theme];
  return (
    <div
      id={id}
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-3xl border shadow-sm",
        t.border,
        className
      )}
    >
      <div
        className={cn(
          // Keep the tint on a visible card surface instead of fading to the
          // near-black page background in dark mode.
          "absolute inset-0 bg-gradient-to-br via-card/70 to-card",
          t.from
        )}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at top right, ${t.radial}, transparent 58%)`,
        }}
        aria-hidden
      />
      <div
        className={cn(
          "absolute -bottom-16 left-1/2 h-40 w-[110%] -translate-x-1/2 rounded-[100%] blur-2xl",
          t.blur
        )}
        aria-hidden
      />
      <div className="relative z-10 flex w-full flex-1 flex-col text-foreground">
        {children}
      </div>
    </div>
  );
}
