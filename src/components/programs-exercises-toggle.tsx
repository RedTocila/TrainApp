"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, LayoutGrid, Library } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { useInstantNavigate } from "@/components/use-instant-navigate";
import { cn } from "@/lib/utils";

function ToggleLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigateStart,
  exactMatch,
}: {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  active: boolean;
  onNavigateStart?: (href: string) => void;
  exactMatch?: boolean;
}) {
  const { handlePointerDown, handlePointerUp, handlePointerCancel, handleClick } =
    useInstantNavigate(href, { onNavigateStart, exactMatch });

  return (
    <Link
      href={href}
      prefetch
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors touch-manipulation select-none [-webkit-tap-highlight-color:transparent]",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** Plans · Workouts · Exercises under the Plans section tab. */
export function ProgramsExercisesToggle({ className }: { className?: string }) {
  const pathname = usePathname();
  const platform = usePlatformCopy();
  const { pendingHref, setPendingHref } = useDashboardNavPending();
  const activePath = pendingHref ?? pathname;

  const onPlans = activePath.startsWith("/dashboard/workout/plans");
  const onWorkouts =
    activePath === "/dashboard/workout" ||
    activePath.startsWith("/dashboard/workout/folder") ||
    activePath.startsWith("/dashboard/workout/workouts");
  const onExercises = activePath.startsWith("/dashboard/workout/exercises");

  if (!onPlans && !onWorkouts && !onExercises) return null;

  return (
    <div
      className={cn("flex gap-1 rounded-xl bg-secondary/50 p-1", className)}
      role="tablist"
      aria-label={platform.nav.plans}
    >
      <ToggleLink
        href="/dashboard/workout/plans"
        label={platform.workout.plansTile}
        icon={CalendarRange}
        active={onPlans}
        onNavigateStart={setPendingHref}
      />
      <ToggleLink
        href="/dashboard/workout"
        label={platform.workout.workoutsTile}
        icon={LayoutGrid}
        active={onWorkouts}
        onNavigateStart={setPendingHref}
        exactMatch
      />
      <ToggleLink
        href="/dashboard/workout/exercises"
        label={platform.workout.exercisesTile}
        icon={Library}
        active={onExercises}
        onNavigateStart={setPendingHref}
      />
    </div>
  );
}
