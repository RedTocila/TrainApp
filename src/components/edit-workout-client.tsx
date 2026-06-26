"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { WorkoutBuilder } from "@/components/workout-builder";
import { WorkoutScheduleForm } from "@/components/workout-schedule-form";
import { MoveWorkoutButton } from "@/components/move-workout-dialog";
import {
  ProgramEditTabs,
  type ProgramEditTab,
} from "@/components/programs/program-edit-tabs";
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
  const searchParams = useSearchParams();
  const initialTab: ProgramEditTab =
    searchParams.get("tab") === "schedule" ? "schedule" : "build";
  const [tab, setTab] = useState<ProgramEditTab>(initialTab);

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleTabChange = (next: ProgramEditTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "schedule") url.searchParams.set("tab", "schedule");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProgramEditTabs tab={tab} onTabChange={handleTabChange} />
        {folders.length > 1 && (
          <MoveWorkoutButton
            planId={plan.id}
            planTitle={plan.title}
            currentFolderId={plan.folder_id}
            folders={folders}
            onMoved={handleRefresh}
          />
        )}
      </div>

      {tab === "build" ? (
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Schedule on calendar</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pick which workout day to repeat and on which weekdays. You can schedule
              different days from the same program separately.
            </p>
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
      )}
    </div>
  );
}
