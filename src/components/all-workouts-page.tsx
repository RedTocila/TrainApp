"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [items, setItems] = useState(workouts);
  const [categoryFilter, setCategoryFilter] = useState<WorkoutCategoryFilterId>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  useEffect(() => {
    setItems(workouts);
  }, [workouts]);

  // Muscle maps need exercises — hide empty shells from a bad seed / draft.
  const workoutsWithExercises = useMemo(
    () => items.filter((item) => collectPlanExercises(item).length > 0),
    [items]
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
      onConfirm: async () => {
        const previous = items;
        setDeletingId(planId);
        setItems((current) => current.filter((item) => item.plan.id !== planId));
        try {
          const result = await deletePersonalWorkoutPlan(planId);
          if (result && "error" in result && result.error) {
            setItems(previous);
            return;
          }
          router.refresh();
        } catch {
          setItems(previous);
        } finally {
          setDeletingId(null);
        }
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
        {giveUpDialog}
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
                deleting={deletingId === item.plan.id}
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
