"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, HeartPulse, LayoutGrid, Library } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { useDashboardNavPending } from "@/components/dashboard-nav-pending";
import { useInstantNavigate } from "@/components/use-instant-navigate";
import { cn } from "@/lib/utils";

function ToggleLink({
  href,
  label,
  icon: Icon,
  active,
  activeClass,
  onNavigateStart,
  exactMatch,
}: {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  active: boolean;
  activeClass: string;
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
        "flex flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-semibold transition-colors touch-manipulation select-none [-webkit-tap-highlight-color:transparent] sm:gap-1.5 sm:px-2 sm:text-sm",
        active
          ? activeClass
          : "text-zinc-600 hover:bg-white/[0.03] hover:text-zinc-400"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** Plans · Workouts · Exercises · Cardio under the workout hub. */
export function ProgramsExercisesToggle({ className }: { className?: string }) {
  const pathname = usePathname();
  const platform = usePlatformCopy();
  const { pendingHref, setPendingHref } = useDashboardNavPending();
  const activePath = pendingHref ?? pathname;

  const onCardio = activePath.startsWith("/dashboard/workout/cardio");
  const onPlans = activePath.startsWith("/dashboard/workout/plans");
  const onWorkouts =
    !onCardio &&
    (activePath === "/dashboard/workout" ||
      activePath.startsWith("/dashboard/workout/folder") ||
      activePath.startsWith("/dashboard/workout/workouts"));
  const onExercises = activePath.startsWith("/dashboard/workout/exercises");

  if (!onPlans && !onWorkouts && !onExercises && !onCardio) return null;

  return (
    <div
      className={cn(
        "flex gap-0.5 rounded-xl border border-border/60 bg-secondary/60 p-1",
        className
      )}
      role="tablist"
      aria-label={platform.nav.plans}
    >
      <ToggleLink
        href="/dashboard/workout/plans"
        label={platform.workout.plansTile}
        icon={CalendarRange}
        active={onPlans}
        activeClass="bg-sky-500/12 text-sky-400/90"
        onNavigateStart={setPendingHref}
      />
      <ToggleLink
        href="/dashboard/workout"
        label={platform.workout.workoutsTile}
        icon={LayoutGrid}
        active={onWorkouts}
        activeClass="bg-primary/12 text-primary/90"
        onNavigateStart={setPendingHref}
        exactMatch
      />
      <ToggleLink
        href="/dashboard/workout/exercises"
        label={platform.workout.exercisesTile}
        icon={Library}
        active={onExercises}
        activeClass="bg-violet-500/12 text-violet-400/90"
        onNavigateStart={setPendingHref}
      />
      <ToggleLink
        href="/dashboard/workout/cardio"
        label={platform.cardio.title}
        icon={HeartPulse}
        active={onCardio}
        activeClass="bg-orange-500/12 text-orange-400/90"
        onNavigateStart={setPendingHref}
      />
    </div>
  );
}
