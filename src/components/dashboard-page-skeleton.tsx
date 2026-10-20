import { cn } from "@/lib/utils";

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-secondary/80", className)} />;
}

export function DashboardHomeBelowFoldSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3 sm:gap-4 md:gap-5" role="status" aria-busy="true">
      <Pulse className="h-40 w-full rounded-2xl" />
      <Pulse className="h-40 w-full rounded-2xl" />
      <Pulse className="h-36 w-full rounded-2xl" />
      <Pulse className="h-36 w-full rounded-2xl" />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6" role="status" aria-busy="true" aria-live="polite">
      <div className="-mx-3 -mt-3 sm:-mx-4 sm:-mt-4 md:-mx-6 md:-mt-6">
        <Pulse className="h-28 w-full rounded-none sm:h-32" />
      </div>
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <Pulse className="h-24 w-full" />
        <div className="grid items-start gap-3 sm:grid-cols-2">
          <Pulse className="h-52 w-full" />
          <Pulse className="h-52 w-full" />
        </div>
        <div className="grid grid-cols-2 items-start gap-3">
          <Pulse className="h-44 w-full sm:h-48" />
          <Pulse className="h-44 w-full sm:h-48" />
        </div>
        <Pulse className="h-40 w-full" />
        <Pulse className="h-36 w-full" />
      </div>
    </div>
  );
}

function ListPageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="mx-auto max-w-3xl space-y-3"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <Pulse className="h-9 w-40 rounded-lg" />
        <Pulse className="h-9 w-24 rounded-full" />
      </div>
      <Pulse className="h-10 w-full rounded-lg" />
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Pulse key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-5"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Pulse className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Pulse className="h-5 w-28 rounded-md" />
            <Pulse className="h-3 w-40 rounded-md" />
          </div>
        </div>
        <Pulse className="h-14 w-28" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Pulse className="h-56 w-full" />
        <Pulse className="h-56 w-full" />
      </div>
      <Pulse className="h-40 w-full" />
    </div>
  );
}

function ClassesSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-4"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Pulse className="h-9 w-48 rounded-lg" />
      <Pulse className="h-4 w-64 rounded-md" />
      <div className="space-y-3">
        <Pulse className="h-36 w-full" />
        <Pulse className="h-36 w-full" />
        <Pulse className="h-36 w-full" />
      </div>
    </div>
  );
}

function AiSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-live="polite">
      <Pulse className="h-32 w-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Pulse className="h-28 w-full" />
        <Pulse className="h-28 w-full" />
      </div>
      <Pulse className="h-40 w-full" />
    </div>
  );
}

function DayDetailSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-4"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Pulse className="h-9 w-24 rounded-md" />
      <Pulse className="h-72 w-full rounded-2xl" />
      <Pulse className="h-24 w-full" />
    </div>
  );
}

/** Nutrition day — macro detail cards + meal feed placeholders. */
function NutritionDaySkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-3"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Pulse className="h-28 w-full rounded-2xl" />
      <Pulse className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Pulse className="h-28 w-full rounded-2xl" />
        <Pulse className="h-28 w-full rounded-2xl" />
        <Pulse className="h-28 w-full rounded-2xl" />
        <Pulse className="h-28 w-full rounded-2xl" />
      </div>
      <div className="space-y-2.5 pt-1">
        <Pulse className="h-5 w-32 rounded-md" />
        <Pulse className="h-20 w-full rounded-2xl" />
        <Pulse className="h-20 w-full rounded-2xl" />
        <Pulse className="h-20 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/** Meal library / plans list with macro-ish row cards. */
function NutritionMealsSkeleton() {
  return (
    <div
      className="mx-auto max-w-5xl space-y-4"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <Pulse className="h-9 w-40 rounded-lg" />
        <Pulse className="h-9 w-24 rounded-full" />
      </div>
      <Pulse className="h-10 w-full rounded-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Pulse key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function WorkoutBone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-white/[0.08]",
        className
      )}
    />
  );
}

function WorkoutPreviewCardSkeleton() {
  return (
    <div className="flex shrink-0 items-start gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <WorkoutBone className="h-14 w-14 shrink-0 rounded-xl" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex h-5 items-center justify-between gap-3">
          <WorkoutBone className="h-3.5 w-[62%]" />
          <WorkoutBone className="h-2.5 w-7 shrink-0" />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <WorkoutBone className="h-11 rounded-lg" />
          <WorkoutBone className="h-11 rounded-lg" />
          <WorkoutBone className="h-11 rounded-lg" />
        </div>
        <WorkoutBone className="h-2.5 w-14" />
        <WorkoutBone className="h-2.5 w-[88%]" />
        <WorkoutBone className="h-2.5 w-36" />
      </div>
    </div>
  );
}

/** Banner, summary line, and exercise rows — same stack as the ready screen. */
export function WorkoutReadyBodySkeleton() {
  return (
    <div className="flex shrink-0 flex-col gap-3">
      <WorkoutBone className="aspect-[16/10] w-full shrink-0 rounded-3xl bg-zinc-800" />
      <WorkoutBone className="mx-auto h-2.5 w-28" />
      <WorkoutBone className="mx-auto h-2.5 w-52" />
      <div className="flex flex-col gap-2">
        <WorkoutPreviewCardSkeleton />
        <WorkoutPreviewCardSkeleton />
        <WorkoutPreviewCardSkeleton />
      </div>
    </div>
  );
}

export function WorkoutOpenSkeleton({
  variant = "page",
}: {
  /** `panel` sits inside an already-mounted session (no second page chrome). */
  variant?: "page" | "panel";
} = {}) {
  if (variant === "panel") {
    return (
      <div role="status" aria-busy="true" aria-live="polite">
        <WorkoutReadyBodySkeleton />
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex h-[calc(100dvh-0.75rem)] max-h-[calc(100dvh-0.75rem)] max-w-lg flex-col gap-2 overflow-hidden bg-background px-2 pb-[max(0.75rem,var(--safe-area-bottom))] pt-[max(0.35rem,var(--safe-area-top))]"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex shrink-0 items-center gap-2 px-1">
        <WorkoutBone className="h-11 w-11 shrink-0 rounded-full" />
        <WorkoutBone className="mx-auto h-4 w-44 max-w-[58%]" />
        <WorkoutBone className="h-11 w-11 shrink-0 rounded-full bg-primary/25" />
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-1">
        <WorkoutBone className="h-7 rounded-lg" />
        <WorkoutBone className="h-7 rounded-lg bg-primary/20" />
        <WorkoutBone className="h-7 rounded-lg" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-1">
        <WorkoutReadyBodySkeleton />
      </div>
    </div>
  );
}

/** Pulse placeholder shaped like the interval timer, used while that clock is loading. */
export function TimerSessionSkeleton() {
  return (
    <div
      data-native-pull-refresh="off"
      className="fixed inset-0 z-[200] flex h-dvh max-h-dvh flex-col bg-background"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex shrink-0 items-center gap-2 px-3 pt-[max(0.35rem,var(--safe-area-top))]">
        <WorkoutBone className="h-11 w-11 shrink-0 rounded-full" />
        <WorkoutBone className="mx-auto h-4 w-40 max-w-[50%]" />
        <WorkoutBone className="h-11 w-11 shrink-0 rounded-full bg-primary/25" />
      </div>
      <WorkoutBone className="mx-4 mt-3 min-h-0 flex-1 rounded-3xl bg-zinc-800" />
      <div className="flex shrink-0 flex-col items-center gap-2 px-4 py-3">
        <WorkoutBone className="h-3 w-24" />
        <WorkoutBone className="h-14 w-40 rounded-2xl" />
        <WorkoutBone className="h-5 w-48" />
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 px-4">
        <WorkoutBone className="h-12 rounded-2xl" />
        <WorkoutBone className="h-12 rounded-2xl" />
      </div>
      <div className="flex shrink-0 flex-col gap-2 px-4 pb-[max(0.5rem,var(--safe-area-bottom))] pt-3">
        <WorkoutBone className="h-11 w-full rounded-full bg-primary/20" />
        <WorkoutBone className="h-11 w-full rounded-full" />
      </div>
    </div>
  );
}

/** Session loading state. `timer` matches the interval clock; otherwise the workout page. */
export function SessionBootShell({
  variant = "session",
}: {
  variant?: "session" | "timer";
} = {}) {
  if (variant === "timer") return <TimerSessionSkeleton />;
  return <WorkoutOpenSkeleton />;
}

function SessionSkeleton() {
  return <SessionBootShell />;
}

function GenericSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" role="status" aria-busy="true" aria-live="polite">
      <Pulse className="h-8 w-48 rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        <Pulse className="h-40 w-full" />
        <Pulse className="h-40 w-full" />
      </div>
      <Pulse className="h-64 w-full" />
    </div>
  );
}

/** Page-shaped pulse placeholders matched to dashboard routes. */
export function DashboardPageSkeleton({ href }: { href?: string | null }) {
  const path = (href ?? "").split("?")[0] ?? "";

  if (!path || path === "/dashboard") return <HomeSkeleton />;
  if (
    path.startsWith("/dashboard/workout/session/") ||
    path === "/dashboard/workout/live" ||
    path === "/dashboard/workout/cardio/session"
  ) {
    return <SessionSkeleton />;
  }
  if (path === "/dashboard/day/nutrition") return <NutritionDaySkeleton />;
  if (
    path === "/dashboard/nutrition/meals" ||
    path.startsWith("/dashboard/nutrition/meals/") ||
    path.startsWith("/dashboard/nutrition/folder/") ||
    path === "/dashboard/nutrition" ||
    path.startsWith("/dashboard/nutrition/")
  ) {
    return <NutritionMealsSkeleton />;
  }
  if (path.startsWith("/dashboard/day/") || path.startsWith("/dashboard/progress-photos")) {
    return <DayDetailSkeleton />;
  }
  if (path.startsWith("/dashboard/ai")) return <AiSkeleton />;
  if (path.startsWith("/dashboard/classes") || path.startsWith("/dashboard/challenges")) {
    return <ClassesSkeleton />;
  }
  if (path.startsWith("/dashboard/profile")) return <ProfileSkeleton />;
  if (path === "/dashboard/workout" || path.startsWith("/dashboard/workout/")) {
    return <ListPageSkeleton />;
  }

  return <GenericSkeleton />;
}

export { NutritionDaySkeleton };
