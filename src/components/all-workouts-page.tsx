"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Calendar,
  CalendarClock,
  Dumbbell,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { deletePersonalWorkoutPlan } from "@/lib/actions/user-workouts";
import type { PersonalWorkoutListItem } from "@/lib/actions/user-workouts";
import { CreateWorkoutButton } from "@/components/programs/create-program-buttons";
import { WorkoutSectionTabs } from "@/components/workout-section-tabs";
import {
  WorkoutCategoryIcon,
  WorkoutDayChip,
} from "@/components/programs/workout-day-chip";
import { WorkoutCategoryFilter as WorkoutCategoryFilterBar } from "@/components/programs/workout-color-legend";
import { StartWorkoutDayButton } from "@/components/start-workout-day-button";
import { MoveWorkoutButton } from "@/components/move-workout-dialog";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { useCoachCopy } from "@/components/locale-provider";
import {
  getWorkoutCategoryStyle,
  inferDayCategory,
  inferProgramCategory,
  isMultiCategoryProgram,
  workoutMatchesCategory,
  type WorkoutCategoryFilter as WorkoutCategoryFilterId,
} from "@/lib/workout-visual-categories";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function ProgramColorStripe({
  planTitle,
  days,
}: {
  planTitle: string;
  days: { title: string; exercises?: { name: string }[] | null }[];
}) {
  if (days.length === 0) {
    const style = getWorkoutCategoryStyle(inferProgramCategory(planTitle, days));
    return <div className={cn("w-2 shrink-0", style.stripe)} aria-hidden />;
  }

  if (isMultiCategoryProgram(days)) {
    const stripes = days
      .map((day) => inferDayCategory(day))
      .filter((c, i, arr) => arr.indexOf(c) === i)
      .slice(0, 5)
      .map((c) => getWorkoutCategoryStyle(c).stripe);

    return (
      <div className="flex w-2 shrink-0 flex-col overflow-hidden" aria-hidden>
        {stripes.map((stripe, i) => (
          <div key={i} className={cn("flex-1 min-h-[0.75rem]", stripe)} />
        ))}
      </div>
    );
  }

  const style = getWorkoutCategoryStyle(inferProgramCategory(planTitle, days));
  return <div className={cn("w-2 shrink-0", style.stripe)} aria-hidden />;
}

export function AllWorkoutsPage({
  workouts,
  folders,
}: {
  workouts: PersonalWorkoutListItem[];
  folders: { id: string; name: string }[];
}) {
  const coachCopy = useCoachCopy();
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState<WorkoutCategoryFilterId>("all");
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  const filteredWorkouts = useMemo(
    () =>
      workouts.filter(({ plan, days }) =>
        workoutMatchesCategory(plan.title, days, categoryFilter)
      ),
    [workouts, categoryFilter]
  );

  const handleDelete = (planId: string, title: string) => {
    confirmGiveUp({
      ...coachCopy.deleteWorkoutPlan(title),
      onConfirm: () => {
        startTransition(async () => {
          await deletePersonalWorkoutPlan(planId);
          router.refresh();
        });
      },
    });
  };

  if (workouts.length === 0) {
    return (
      <>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-black">Workouts</h1>
          <div className="flex items-center gap-1">
            <WorkoutSectionTabs />
            <CreateWorkoutButton iconOnly variant="outline" />
          </div>
        </div>
        <Card className="overflow-hidden border-dashed">
        <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
          <WorkoutCategoryIcon category="general" size="lg" />
          <CreateWorkoutButton label="New workout" />
          <Link href="/dashboard/ai/plans/workout">
            <Button size="sm" variant="secondary">
              <Sparkles className="mr-1.5 h-4 w-4" />
              AI
            </Button>
          </Link>
        </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-black">Workouts</h1>
        <div className="flex items-center gap-1">
          <WorkoutSectionTabs />
          <CreateWorkoutButton iconOnly variant="outline" />
        </div>
      </div>

      <WorkoutCategoryFilterBar
        workouts={workouts}
        selected={categoryFilter}
        onSelectedChange={setCategoryFilter}
      />

      {filteredWorkouts.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No workouts in this category</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setCategoryFilter("all")}
          >
            Show all
          </Button>
        </Card>
      ) : (
      <ul className="space-y-3">
        {filteredWorkouts.map(({ plan, days, scheduleSummary, upcomingCount }) => {
          const exerciseCount = days.reduce(
            (sum, day) => sum + (day.exercises?.length ?? 0),
            0
          );
          const hasExercises = exerciseCount > 0;
          const programCategory = inferProgramCategory(plan.title, days);
          const programStyle = getWorkoutCategoryStyle(programCategory);

          return (
            <li key={plan.id}>
              <Card
                className={cn(
                  "overflow-hidden border-2",
                  programStyle.cardBorder,
                  programStyle.cardBg
                )}
              >
                <div className="flex min-h-[8rem]">
                  <ProgramColorStripe planTitle={plan.title} days={days} />
                  <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-3">
                        <WorkoutCategoryIcon category={programCategory} />
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/workout/${plan.id}/edit`}
                            className="block truncate text-base font-bold leading-tight hover:opacity-90"
                          >
                            {plan.title}
                          </Link>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold",
                                programStyle.chip,
                                programStyle.chipText
                              )}
                            >
                              <Dumbbell className="h-3 w-3" />
                              {exerciseCount}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                              {days.map((day) => {
                                const dayStyle = getWorkoutCategoryStyle(inferDayCategory(day));
                                return (
                                  <span
                                    key={day.id}
                                    className={cn("h-2.5 w-2.5 rounded-full", dayStyle.stripe)}
                                    title={day.title}
                                    aria-hidden
                                  />
                                );
                              })}
                            </span>
                            {upcomingCount > 0 && (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold",
                                  programStyle.scheduleBg,
                                  programStyle.scheduleText
                                )}
                              >
                                <CalendarClock className="h-3 w-3" />
                                {upcomingCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {hasExercises && <StartWorkoutDayButton planId={plan.id} />}
                    </div>

                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium",
                        upcomingCount > 0
                          ? cn(programStyle.scheduleBg, programStyle.scheduleText)
                          : "bg-secondary/50 text-muted-foreground"
                      )}
                    >
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span className="truncate">{scheduleSummary}</span>
                    </div>

                    {days.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {days.map((day) => (
                          <WorkoutDayChip key={day.id} day={day} />
                        ))}
                      </div>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-border/60 pt-3">
                      <Link href={`/dashboard/workout/${plan.id}/edit`}>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-9 w-9"
                          aria-label="Edit workout"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/dashboard/workout/${plan.id}/edit?tab=schedule`}>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9"
                          aria-label="Schedule workout"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                      </Link>
                      {folders.length > 1 && (
                        <MoveWorkoutButton
                          planId={plan.id}
                          planTitle={plan.title}
                          currentFolderId={plan.folder_id}
                          folders={folders}
                        />
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto h-9 w-9"
                        disabled={isPending}
                        onClick={() => handleDelete(plan.id, plan.title)}
                        aria-label={`Delete ${plan.title}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      )}
      {giveUpDialog}
    </>
  );
}
