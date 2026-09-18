import type { ReactNode } from "react";
import Image from "next/image";
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
    accent: string;
    border: string;
    wash: string;
    glow: string;
  }
> = {
  workout: {
    accent: "text-primary",
    border: "border-primary/30",
    wash: "from-primary/18",
    glow: "bg-primary/25",
  },
  nutrition: {
    accent: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
    wash: "from-emerald-500/18",
    glow: "bg-emerald-400/25",
  },
  water: {
    accent: "text-sky-700 dark:text-sky-300",
    border: "border-sky-500/30",
    wash: "from-sky-500/18",
    glow: "bg-sky-400/25",
  },
  cardio: {
    accent: "text-orange-700 dark:text-orange-300",
    border: "border-orange-500/30",
    wash: "from-orange-500/18",
    glow: "bg-orange-400/25",
  },
  bmi: {
    accent: "text-yellow-800 dark:text-yellow-300",
    border: "border-amber-500/30",
    wash: "from-amber-500/18",
    glow: "bg-amber-400/25",
  },
  weight: {
    accent: "text-teal-800 dark:text-teal-300",
    border: "border-teal-500/30",
    wash: "from-teal-500/18",
    glow: "bg-teal-400/25",
  },
  habits: {
    accent: "text-violet-700 dark:text-violet-300",
    border: "border-violet-500/30",
    wash: "from-violet-500/18",
    glow: "bg-violet-400/25",
  },
  lifestyle: {
    accent: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/30",
    wash: "from-rose-500/18",
    glow: "bg-rose-400/25",
  },
  photos: {
    accent: "text-fuchsia-700 dark:text-fuchsia-300",
    border: "border-fuchsia-500/30",
    wash: "from-fuchsia-500/18",
    glow: "bg-fuchsia-400/25",
  },
};

export function dashboardThemeAccent(theme: DashboardCardTheme) {
  return THEME[theme].accent;
}

/** Fixed photo backgrounds for home dashboard cards. */
export const DASHBOARD_CARD_BACKGROUNDS = {
  water: "/dashboard/water.jpg",
  cardio: "/dashboard/cardio.jpg",
  nutrition: "/dashboard/nutrition.jpg",
  photos: "/dashboard/progress-photos.jpg",
  weight: "/dashboard/body-weight.jpg",
  bmi: "/dashboard/bmi.jpg",
  lifestyle: "/dashboard/lifestyle.jpg",
  habits: "/dashboard/habits.jpg",
} as const;

const PHOTO_OBJECT_POSITION: Partial<Record<DashboardCardTheme, string>> = {
  water: "object-[65%_center]",
  cardio: "object-[75%_center]",
  nutrition: "object-center",
  workout: "object-[70%_center]",
  photos: "object-[40%_center]",
  weight: "object-[30%_center]",
  bmi: "object-center",
  lifestyle: "object-[20%_center]",
  habits: "object-center",
};

/** Darker wash for dense pair / nutrition tiles; lighter for the rest. */
const PHOTO_OVERLAY: Partial<Record<DashboardCardTheme, string>> = {
  water: "from-black/60 via-black/38 to-black/22",
  cardio: "from-black/60 via-black/38 to-black/22",
  nutrition: "from-black/60 via-black/38 to-black/22",
};

const DEFAULT_PHOTO_OVERLAY = "from-black/40 via-black/22 to-black/10";

/**
 * Shared dashboard section shell — AI Coach-style accent border, wash, and glow.
 */
export function DashboardThemedShell({
  theme,
  className,
  children,
  id,
  backgroundSrc,
  backgroundAlt = "",
  backgroundPriority = false,
}: {
  theme: DashboardCardTheme;
  className?: string;
  children: ReactNode;
  id?: string;
  backgroundSrc?: string | null;
  backgroundAlt?: string;
  backgroundPriority?: boolean;
}) {
  const t = THEME[theme];
  const hasPhoto = Boolean(backgroundSrc);
  return (
    <div
      id={id}
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-2xl border shadow-sm",
        hasPhoto ? "border-white/15 bg-black" : cn("bg-card", t.border),
        className
      )}
    >
      {hasPhoto ? (
        <>
          <Image
            src={backgroundSrc!}
            alt={backgroundAlt}
            fill
            sizes="(min-width: 768px) 480px, 100vw"
            className={cn(
              "pointer-events-none object-cover",
              PHOTO_OBJECT_POSITION[theme] ?? "object-center"
            )}
            priority={backgroundPriority}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 bg-gradient-to-r",
              PHOTO_OVERLAY[theme] ?? DEFAULT_PHOTO_OVERLAY
            )}
          />
        </>
      ) : (
        <>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 bg-gradient-to-br via-card to-card",
              t.wash
            )}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-2xl",
              t.glow
            )}
          />
        </>
      )}
      <div
        className={cn(
          "relative z-10 flex w-full flex-1 flex-col",
          hasPhoto ? "dashboard-photo-card" : "text-foreground"
        )}
      >
        {children}
      </div>
    </div>
  );
}
