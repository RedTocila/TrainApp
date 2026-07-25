import { cn } from "@/lib/utils";

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-secondary/80", className)} />;
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

function SessionSkeleton() {
  return (
    <div
      className="mx-auto max-w-lg space-y-4 pt-4"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Pulse className="mx-auto h-8 w-48 rounded-lg" />
      <Pulse className="h-16 w-full rounded-2xl" />
      <Pulse className="h-40 w-full rounded-2xl" />
      <Pulse className="h-40 w-full rounded-2xl" />
      <Pulse className="h-12 w-full rounded-full" />
    </div>
  );
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
