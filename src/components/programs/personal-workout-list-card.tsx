"use client";

import Link from "next/link";
import { Calendar, Pencil, Trash2 } from "lucide-react";
import type { PersonalWorkoutListItem } from "@/lib/actions/user-workouts";
import { WorkoutCategoryIcon } from "@/components/programs/workout-day-chip";
import { StartWorkoutDayButton } from "@/components/start-workout-day-button";
import { MoveWorkoutButton } from "@/components/move-workout-dialog";
import { WorkoutMuscleMap } from "@/components/workout-muscle-map";
import {
  DashboardCardNavBody,
  DashboardCardNavLink,
} from "@/components/dashboard-card-nav-link";
import { usePlatformCopy } from "@/components/locale-provider";
import { isIntervalPlan, normalizeHiitConfig } from "@/lib/hiit";
import {
  getWorkoutCategoryStyle,
  inferProgramCategory,
} from "@/lib/workout-visual-categories";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function collectPlanExercises(
  item: PersonalWorkoutListItem
): { name: string }[] {
  const fromDays = item.days.flatMap((day) =>
    (day.exercises ?? []).map((ex) => ({ name: ex.name }))
  );
  if (fromDays.length > 0) return fromDays;

  if (isIntervalPlan(item.plan)) {
    const config = normalizeHiitConfig(item.plan.hiit_config);
    return (config?.exercises ?? []).map((ex) => ({ name: ex.name }));
  }

  return [];
}

export function PersonalWorkoutListCard({
  item,
  folders,
  gender,
  deleting,
  onDelete,
}: {
  item: PersonalWorkoutListItem;
  folders: { id: string; name: string }[];
  gender?: string | null;
  deleting?: boolean;
  onDelete: (planId: string, title: string) => void;
}) {
  const platform = usePlatformCopy();
  const { plan, days, scheduleSummary } = item;
  const exercises = collectPlanExercises(item);
  const exerciseCount = exercises.length;
  const hasExercises = exerciseCount > 0;
  const programCategory = inferProgramCategory(plan.title, days, plan.kind);
  const programStyle = getWorkoutCategoryStyle(programCategory);
  const dayTitle = days.length === 1 ? days[0].title : plan.title;
  const detailsHref = `/dashboard/workout/${plan.id}/edit`;

  const meta = [
    programStyle.shortLabel,
    days.length > 1 ? platform.workout.daysBadge(days.length) : null,
    hasExercises ? platform.common.exercises(exerciseCount) : null,
    scheduleSummary,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card
      className={cn(
        "relative overflow-hidden border",
        programStyle.cardBorder,
        programStyle.cardBg
      )}
    >
      <DashboardCardNavLink href={detailsHref} ariaLabel={plan.title} />
      <div className="flex">
        <div className={cn("w-1 shrink-0", programStyle.stripe)} aria-hidden />
        <DashboardCardNavBody className="flex min-w-0 flex-1 items-stretch gap-2 p-2.5">
          {hasExercises ? (
            <WorkoutMuscleMap
              variant="hero"
              exercises={exercises}
              dayTitle={dayTitle}
              gender={gender}
              showLegend={false}
              bodyMinHeightClass="h-[4.75rem] min-h-0 max-h-[4.75rem]"
              className="w-[5.5rem] shrink-0 self-center sm:w-[6.25rem]"
            />
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <WorkoutCategoryIcon category={programCategory} size="sm" />
                <p className="min-w-0 truncate text-sm font-bold leading-tight">
                  {plan.title}
                </p>
              </div>
              {hasExercises ? (
                <StartWorkoutDayButton planId={plan.id} iconOnly />
              ) : null}
            </div>

            <p className="truncate text-[11px] leading-snug text-muted-foreground">
              {meta}
            </p>

            <div className="mt-auto flex items-center gap-1">
              <Link href={detailsHref}>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {platform.common.edit}
                </Button>
              </Link>
              <Link href={`${detailsHref}?tab=schedule`}>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {platform.workout.flowSchedule}
                </Button>
              </Link>
              {folders.length > 1 ? (
                <MoveWorkoutButton
                  planId={plan.id}
                  planTitle={plan.title}
                  currentFolderId={plan.folder_id}
                  folders={folders}
                />
              ) : null}
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto h-7 w-7"
                disabled={deleting}
                onClick={() => onDelete(plan.id, plan.title)}
                aria-label={`Delete ${plan.title}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </Button>
            </div>
          </div>
        </DashboardCardNavBody>
      </div>
    </Card>
  );
}
