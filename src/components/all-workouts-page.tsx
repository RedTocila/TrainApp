"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePersonalWorkoutPlan } from "@/lib/actions/user-workouts";
import type { PersonalWorkoutListItem } from "@/lib/actions/user-workouts";
import { AiBuildPlanButton } from "@/components/ai-build-plan-button";
import { CreateWorkoutButton } from "@/components/programs/create-program-buttons";
import { WorkoutPageHeader } from "@/components/workout-page-header";
import { WorkoutCategoryIcon } from "@/components/programs/workout-day-chip";
import { WorkoutCategoryFilter as WorkoutCategoryFilterBar } from "@/components/programs/workout-color-legend";
import { PersonalWorkoutListCard } from "@/components/programs/personal-workout-list-card";
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

  const filteredWorkouts = useMemo(
    () =>
      workouts.filter(({ plan, days }) =>
        workoutMatchesCategory(plan.title, days, categoryFilter, plan.kind)
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
        <WorkoutPageHeader
          title="Workouts"
          action={<CreateWorkoutButton iconOnly variant="outline" />}
        />
        <Card className="overflow-hidden border-dashed">
          <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
            <WorkoutCategoryIcon category="general" size="lg" />
            <CreateWorkoutButton label="New workout" />
            <AiBuildPlanButton type="workout" />
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <WorkoutPageHeader
        title="Workouts"
        action={<CreateWorkoutButton iconOnly variant="outline" />}
      />

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
