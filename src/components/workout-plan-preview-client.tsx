"use client";

import Link from "next/link";
import { Calendar, Pencil } from "lucide-react";
import { WorkoutCategoryIcon } from "@/components/programs/workout-day-chip";
import { StartWorkoutDayButton } from "@/components/start-workout-day-button";
import { WorkoutExerciseList } from "@/components/workout-exercise-list";
import { WorkoutMuscleMap } from "@/components/workout-muscle-map";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isIntervalPlan, normalizeHiitConfig } from "@/lib/hiit";
import {
  getWorkoutCategoryStyle,
  inferProgramCategory,
} from "@/lib/workout-visual-categories";
import { cn } from "@/lib/utils";

type PreviewDay = {
  id: string;
  day_index: number;
  title: string;
  exercises: {
    id: string;
    name: string;
    sets: number;
    reps: string;
    notes: string | null;
    image_url?: string | null;
    video_url?: string | null;
    order_index?: number | null;
  }[];
};

type PreviewPlan = {
  id: string;
  title: string;
  description: string | null;
  kind: string | null;
  hiit_config: unknown;
};

export function WorkoutPlanPreviewClient({
  plan,
  days,
  gender,
  scheduleSummary,
}: {
  plan: PreviewPlan;
  days: PreviewDay[];
  gender?: string | null;
  scheduleSummary?: string | null;
}) {
  const platform = usePlatformCopy();
  const programCategory = inferProgramCategory(plan.title, days, plan.kind);
  const programStyle = getWorkoutCategoryStyle(programCategory);
  const editHref = `/dashboard/workout/${plan.id}/edit`;

  const dayExercises = days.flatMap((day) => day.exercises ?? []);
  const hiitExercises = isIntervalPlan(plan)
    ? (normalizeHiitConfig(plan.hiit_config)?.exercises ?? []).map((ex, index) => ({
        id: `hiit-${index}`,
        name: ex.name,
        sets: 1,
        reps: `${ex.work_seconds}s`,
        notes: ex.notes ?? null,
        image_url: ex.image_url,
        video_url: ex.video_url,
      }))
    : [];

  const allExercises =
    dayExercises.length > 0
      ? dayExercises.map((ex) => ({ name: ex.name }))
      : hiitExercises.map((ex) => ({ name: ex.name }));

  const exerciseCount =
    dayExercises.length > 0 ? dayExercises.length : hiitExercises.length;
  const dayTitle = days.length === 1 ? days[0].title : plan.title;

  const meta = [
    programStyle.shortLabel,
    days.length > 1 ? platform.workout.daysBadge(days.length) : null,
    exerciseCount > 0 ? platform.common.exercises(exerciseCount) : null,
    scheduleSummary,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          "overflow-hidden border",
          programStyle.cardBorder,
          programStyle.cardBg
        )}
      >
        <div className="flex">
          <div className={cn("w-1 shrink-0", programStyle.stripe)} aria-hidden />
          <div className="flex min-w-0 flex-1 items-stretch gap-3 p-3">
            {allExercises.length > 0 ? (
              <WorkoutMuscleMap
                variant="hero"
                exercises={allExercises}
                dayTitle={dayTitle}
                gender={gender}
                showLegend={false}
                bodyMinHeightClass="h-[5.5rem] min-h-0 max-h-[5.5rem]"
                className="w-[6rem] shrink-0 self-center sm:w-[6.5rem]"
              />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <WorkoutCategoryIcon category={programCategory} size="sm" />
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold leading-tight">
                      {plan.title}
                    </h2>
                    {meta ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {meta}
                      </p>
                    ) : null}
                  </div>
                </div>
                {exerciseCount > 0 ? (
                  <StartWorkoutDayButton planId={plan.id} iconOnly />
                ) : null}
              </div>
              {plan.description ? (
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              ) : null}
              <div className="mt-auto flex flex-wrap items-center gap-1">
                <Link href={editHref}>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5 text-xs">
                    <Pencil className="h-3.5 w-3.5" />
                    {platform.common.edit}
                  </Button>
                </Link>
                <Link href={`${editHref}?tab=schedule`}>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5 text-xs">
                    <Calendar className="h-3.5 w-3.5" />
                    {platform.workout.flowSchedule}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {hiitExercises.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {platform.workout.exercisesTile}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorkoutExerciseList exercises={hiitExercises} gender={gender} />
          </CardContent>
        </Card>
      ) : null}

      {hiitExercises.length === 0
        ? days.map((day) => {
            const exercises = [...(day.exercises ?? [])].sort(
              (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
            );
            if (exercises.length === 0) return null;
            return (
              <Card key={day.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {days.length > 1 ? day.title : platform.workout.exercisesTile}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <WorkoutExerciseList exercises={exercises} gender={gender} />
                </CardContent>
              </Card>
            );
          })
        : null}

      {exerciseCount === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {platform.workout.noExercisesTitle}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
