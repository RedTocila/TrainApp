"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Calendar, Dumbbell, Pencil, Trash2 } from "lucide-react";
import { deletePersonalWorkoutPlan } from "@/lib/actions/user-workouts";
import type { PersonalWorkoutListItem, WorkoutPickItem } from "@/lib/actions/user-workouts";
import { AddToFolderMenu } from "@/components/add-to-folder-menu";
import { StartWorkoutDayButton } from "@/components/start-workout-day-button";
import { MoveWorkoutButton } from "@/components/move-workout-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function FolderWorkoutsPage({
  folderId,
  folderName,
  workouts,
  folders,
  availableWorkouts,
}: {
  folderId: string;
  folderName: string;
  workouts: PersonalWorkoutListItem[];
  folders: { id: string; name: string }[];
  availableWorkouts: WorkoutPickItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = (planId: string, title: string) => {
    if (!confirm(`Delete "${title}"? This removes the workout and its schedule.`)) return;
    startTransition(async () => {
      await deletePersonalWorkoutPlan(planId);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3">
        <Link href="/dashboard/workout">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit">
            <ArrowLeft className="mr-1 h-4 w-4" />
            All folders
          </Button>
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black">{folderName}</h1>
            <p className="text-sm text-muted-foreground">
              Workouts in this folder and their schedule
            </p>
          </div>
          <AddToFolderMenu
            folderId={folderId}
            folderName={folderName}
            availableWorkouts={availableWorkouts}
          />
        </div>
      </div>

      {workouts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Dumbbell className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No workouts in this folder</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a new workout or add one you&apos;ve already built.
              </p>
            </div>
            <AddToFolderMenu
              folderId={folderId}
              folderName={folderName}
              availableWorkouts={availableWorkouts}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {workouts.map(({ plan, days, scheduleSummary, upcomingCount }) => (
            <Card key={plan.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{plan.title}</p>
                    {plan.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {days.length} day{days.length === 1 ? "" : "s"}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {scheduleSummary}
                      </span>
                      {upcomingCount > 0 && (
                        <Badge variant="outline">{upcomingCount} upcoming</Badge>
                      )}
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {days.map((day) => (
                        <li key={day.id}>
                          {day.title} · {day.exercises?.length ?? 0} exercises
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {days.length > 0 && <StartWorkoutDayButton planId={plan.id} />}
                    <Link href={`/dashboard/workout/${plan.id}/edit`}>
                      <Button size="sm" variant="outline">
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                    </Link>
                    <MoveWorkoutButton
                      planId={plan.id}
                      planTitle={plan.title}
                      currentFolderId={plan.folder_id}
                      folders={folders}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => handleDelete(plan.id, plan.title)}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
