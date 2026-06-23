"use client";

import { useRouter } from "next/navigation";
import { WorkoutBuilder } from "@/components/workout-builder";
import { WorkoutScheduleForm } from "@/components/workout-schedule-form";
import { MoveWorkoutButton } from "@/components/move-workout-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Exercise, WorkoutDay, WorkoutPlan } from "@/lib/types";
import type { InferredSchedule } from "@/lib/schedule-utils";

interface EditWorkoutClientProps {
  plan: WorkoutPlan;
  days: WorkoutDay[];
  initialSchedule: InferredSchedule | null;
  folders: { id: string; name: string }[];
}

export function EditWorkoutClient({
  plan,
  days,
  initialSchedule,
  folders,
}: EditWorkoutClientProps) {
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {folders.length > 1 && (
        <div className="flex justify-end">
          <MoveWorkoutButton
            planId={plan.id}
            planTitle={plan.title}
            currentFolderId={plan.folder_id}
            folders={folders}
            onMoved={handleRefresh}
          />
        </div>
      )}

      <WorkoutBuilder
        mode="client"
        stayOnPage
        planId={plan.id}
        initialTitle={plan.title}
        initialDescription={plan.description ?? ""}
        initialDays={days.map((d) => ({
          ...d,
          day_index: d.day_index,
          exercises: (d.exercises ?? []).map((e: Exercise) => ({
            name: e.name,
            sets: e.sets,
            reps: e.reps,
            rest_seconds: e.rest_seconds,
            notes: e.notes ?? undefined,
            video_url: e.video_url ?? undefined,
          })),
        }))}
        onSaved={handleRefresh}
      />

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkoutScheduleForm
            key={
              initialSchedule
                ? `${initialSchedule.dayId}-${initialSchedule.upcomingCount}-${initialSchedule.weeks}`
                : "new"
            }
            planId={plan.id}
            days={days}
            initialSchedule={initialSchedule}
            onSaved={handleRefresh}
          />
        </CardContent>
      </Card>
    </div>
  );
}
