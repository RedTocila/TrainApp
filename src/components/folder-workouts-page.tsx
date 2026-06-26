"use client";
import { useCoachCopy, useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Calendar, Dumbbell, Pencil, Trash2 } from "lucide-react";
import { deletePersonalWorkoutPlan } from "@/lib/actions/user-workouts";
import type { PersonalWorkoutListItem, WorkoutPickItem } from "@/lib/actions/user-workouts";
import { AddToFolderMenu } from "@/components/add-to-folder-menu";
import { WorkoutDayChip, WorkoutCategoryIcon } from "@/components/programs/workout-day-chip";
import { StartWorkoutDayButton } from "@/components/start-workout-day-button";
import { MoveWorkoutButton } from "@/components/move-workout-dialog";
import {
  getWorkoutCategoryStyle,
  inferProgramCategory,
} from "@/lib/workout-visual-categories";
import { cn } from "@/lib/utils";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
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
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  const handleDelete = (planId: string, title: string) => {
    confirmGiveUp({
      ...coachCopy.deleteWorkoutPlan(title),
      onConfirm: async () => {
        await deletePersonalWorkoutPlan(planId);
        router.refresh();
      },
    });
  };

  return (
    <div className="space-y-5">
      <Link href="/dashboard/workout">
        <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1 px-2">
          <ArrowLeft className="h-4 w-4" />
          {platform.workout.foldersNav}
        </Button>
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Dumbbell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black">{folderName}</h1>
            <p className="text-xs text-muted-foreground">
              {platform.workout.programsCount(workouts.length)}
            </p>
          </div>
        </div>
        <AddToFolderMenu
          folderId={folderId}
          folderName={folderName}
          availableWorkouts={availableWorkouts}
        />
      </div>

      {workouts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Dumbbell className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">{coachLabels.emptyWorkoutFolder}</p>
            <AddToFolderMenu
              folderId={folderId}
              folderName={folderName}
              availableWorkouts={availableWorkouts}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {workouts.map(({ plan, days, scheduleSummary, upcomingCount }) => {
            const exerciseTotal = days.reduce(
              (sum, day) => sum + (day.exercises?.length ?? 0),
              0
            );
            const programCategory = inferProgramCategory(plan.title, days);
            const programStyle = getWorkoutCategoryStyle(programCategory);

            return (
              <Card
                key={plan.id}
                className={cn("overflow-hidden border-2", programStyle.cardBorder, programStyle.cardBg)}
              >
                <div className={cn("h-1.5 w-full", programStyle.stripe)} aria-hidden />
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <WorkoutCategoryIcon category={programCategory} size="sm" />
                      <div>
                        <p className="font-semibold">{plan.title}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">
                            {platform.workout.daysBadge(days.length)}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {platform.workout.exBadge(exerciseTotal)}
                          </Badge>
                          {upcomingCount > 0 && (
                            <Badge className={cn("text-[10px]", programStyle.scheduleBg, programStyle.scheduleText)}>
                              {platform.workout.scheduledBadge(upcomingCount)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {days.length > 0 && <StartWorkoutDayButton planId={plan.id} />}
                      <Link href={`/dashboard/workout/${plan.id}/edit`}>
                        <Button size="icon" variant="outline" className="h-8 w-8">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{scheduleSummary}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {days.map((day) => (
                      <WorkoutDayChip key={day.id} day={day} />
                    ))}
                  </div>

                  <div className="flex gap-1 border-t border-border pt-2">
                    <MoveWorkoutButton
                      planId={plan.id}
                      planTitle={plan.title}
                      currentFolderId={plan.folder_id}
                      folders={folders}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-8"
                      disabled={isPending}
                      onClick={() => handleDelete(plan.id, plan.title)}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {giveUpDialog}
    </div>
  );
}
