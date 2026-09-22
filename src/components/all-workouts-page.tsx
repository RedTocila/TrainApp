"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePersonalWorkoutPlan } from "@/lib/actions/user-workouts";
import type { PersonalWorkoutListItem } from "@/lib/actions/user-workouts";
import { BuildWorkoutButton } from "@/components/build-workout-button";
import { WorkoutPageHeader } from "@/components/workout-page-header";
import { WorkoutCategoryIcon } from "@/components/programs/workout-day-chip";
import { WorkoutCategoryFilter as WorkoutCategoryFilterBar } from "@/components/programs/workout-color-legend";
import { PersonalWorkoutListCard, collectPlanExercises } from "@/components/programs/personal-workout-list-card";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { useCoachCopy } from "@/components/locale-provider";
import {
  workoutMatchesCategory,
  type WorkoutCategoryFilter as WorkoutCategoryFilterId,
} from "@/lib/workout-visual-categories";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AllWorkoutsPage({
  workouts,
  folders,
  gender,
}: {
  workouts: PersonalWorkoutListItem[];
  folders: { id: string; name: string }[];
  gender?: string | null;
}) {
  const coachCopy = useCoachCopy();
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState<WorkoutCategoryFilterId>("all");
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  // Muscle maps need exercises — hide empty shells from a bad seed / draft.
  const workoutsWithExercises = useMemo(
    () => workouts.filter((item) => collectPlanExercises(item).length > 0),
    [workouts]
  );

  const filteredWorkouts = useMemo(
    () =>
      workoutsWithExercises.filter(({ plan, days }) =>
        workoutMatchesCategory(plan.title, days, categoryFilter, plan.kind)
      ),
    [workoutsWithExercises, categoryFilter]
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

  if (workoutsWithExercises.length === 0) {
    return (
      <>
        <WorkoutPageHeader title="Workouts" />
        <Card className="overflow-hidden border-dashed">
          <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
            <WorkoutCategoryIcon category="general" size="lg" />
            <BuildWorkoutButton />
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <WorkoutPageHeader title="Workouts" />

      <WorkoutCategoryFilterBar
        workouts={workoutsWithExercises}
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
          {filteredWorkouts.map((item) => (
            <li key={item.plan.id}>
              <PersonalWorkoutListCard
                item={item}
                folders={folders}
                gender={gender}
                deleting={isPending}
                onDelete={handleDelete}
              />
            </li>
          ))}
        </ul>
      )}
      {giveUpDialog}
    </>
  );
}
