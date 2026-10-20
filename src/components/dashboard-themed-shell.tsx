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
  | "photos"
  | "steps";

const THEME: Record<
  DashboardCardTheme,
  {
    accent: string;
    border: string;
    wash: string;
  }
> = {
  workout: {
    accent: "text-primary",
    border: "border-primary/40",
    wash: "from-primary/18",
  },
  nutrition: {
    accent: "text-emerald-700 dark:text-emerald-300",
    border: "border-primary/40",
    wash: "from-primary/18",
  },
  water: {
    accent: "text-sky-700 dark:text-sky-300",
    border: "border-primary/40",
    wash: "from-primary/18",
  },
  cardio: {
    accent: "text-orange-700 dark:text-orange-300",
    border: "border-primary/40",
    wash: "from-primary/18",
  },
  bmi: {
    accent: "text-yellow-800 dark:text-yellow-300",
    border: "border-primary/40",
    wash: "from-primary/18",
  },
  weight: {
    accent: "text-teal-800 dark:text-teal-300",
    border: "border-primary/40",
    wash: "from-primary/18",
  },
  habits: {
    accent: "text-violet-700 dark:text-violet-300",
    border: "border-primary/40",
    wash: "from-primary/18",
  },
  lifestyle: {
    accent: "text-rose-700 dark:text-rose-300",
    border: "border-primary/40",
    wash: "from-primary/18",
  },
  photos: {
    accent: "text-fuchsia-700 dark:text-fuchsia-300",
    border: "border-primary/40",
    wash: "from-primary/18",
  },
  steps: {
    accent: "text-lime-800 dark:text-lime-300",
    border: "border-primary/40",
    wash: "from-primary/18",
  },
};

export function dashboardThemeAccent(theme: DashboardCardTheme) {
  return THEME[theme].accent;
}

/** Fixed photo backgrounds for home dashboard cards. */
export const DASHBOARD_CARD_BACKGROUNDS = {
  water: "/dashboard/water-card.jpg",
  cardio: "/dashboard/cardio-card.jpg",
  nutrition: "/dashboard/nutrition-card.jpg",
  photos: "/dashboard/progress-photos.jpg",
  weight: "/dashboard/body-weight.jpg",
  bmi: "/dashboard/bmi.jpg",
  steps: "/dashboard/steps.jpg",
  lifestyle: "/dashboard/lifestyle.jpg",
  habits: "/dashboard/habits.jpg",
} as const;

const PHOTO_OBJECT_POSITION: Partial<Record<DashboardCardTheme, string>> = {
  water: "object-[65%_center]",
  cardio: "object-[75%_center]",
  nutrition: "object-center",
  workout: "object-[68%_42%] scale-[1.22] origin-[68%_42%]",
  photos: "object-[40%_center]",
  weight: "object-[30%_center]",
  bmi: "object-[center_32%]",
  steps: "object-[center_28%]",
  lifestyle: "object-[20%_center]",
  habits: "object-center",
};

/** Darker wash for dense pair / nutrition tiles; lighter for the rest. */
const PHOTO_OVERLAY: Partial<Record<DashboardCardTheme, string>> = {
  water: "from-black/68 via-black/52 to-black/40",
  cardio: "from-black/68 via-black/52 to-black/40",
  nutrition: "from-black/72 via-black/64 to-black/58",
};

const DEFAULT_PHOTO_OVERLAY = "from-black/40 via-black/22 to-black/10";

/**
 * Solid dark card — same shell as the home nutrition card.
 */
export function DashboardSolidCard({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  theme?: DashboardCardTheme;
}) {
  return (
    <div
      id={id}
      className={cn(
        "dashboard-photo-card relative flex w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.85)]",
        className
      )}
    >
      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col">{children}</div>
    </div>
  );
}

/**
 * Shared dashboard section shell — themed border + soft depth shadow.
 * Pass `solid` for the nutrition-card container instead of a photo.
 */
export function DashboardThemedShell({
  theme,
  className,
  children,
  id,
  backgroundSrc,
  backgroundAlt = "",
  backgroundPriority = false,
  backgroundObjectClass,
  solid = false,
}: {
  theme: DashboardCardTheme;
  className?: string;
  children: ReactNode;
  id?: string;
  backgroundSrc?: string | null;
  backgroundAlt?: string;
  backgroundPriority?: boolean;
  /** Optional override for photo object-position / scale. */
  backgroundObjectClass?: string;
  solid?: boolean;
}) {
  if (solid) {
    return (
      <DashboardSolidCard id={id} className={className} theme={theme}>
        {children}
      </DashboardSolidCard>
    );
  }

  const t = THEME[theme];
  const hasPhoto = Boolean(backgroundSrc);
  return (
    <div
      id={id}
      className={cn(
        "dashboard-photo-card relative flex w-full flex-col overflow-hidden rounded-3xl border",
        t.border,
        hasPhoto
          ? "bg-zinc-950 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.85)]"
          : "bg-card shadow-[0_12px_32px_-12px_rgba(0,0,0,0.55)]",
        className
      )}
    >
      {hasPhoto ? (
        <>
          <div className="pointer-events-none absolute inset-0">
            <Image
              src={backgroundSrc!}
              alt={backgroundAlt}
              fill
              sizes="(min-width: 768px) 480px, 100vw"
              className={cn(
                "object-cover",
                backgroundObjectClass ??
                  PHOTO_OBJECT_POSITION[theme] ??
                  "object-center"
              )}
              priority={backgroundPriority}
            />
          </div>
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
