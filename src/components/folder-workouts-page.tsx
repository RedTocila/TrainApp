"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeft, Dumbbell } from "lucide-react";
import { deletePersonalWorkoutPlan } from "@/lib/actions/user-workouts";
import type { PersonalWorkoutListItem, WorkoutPickItem } from "@/lib/actions/user-workouts";
import { AddToFolderMenu } from "@/components/add-to-folder-menu";
import { PersonalWorkoutListCard } from "@/components/programs/personal-workout-list-card";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { useCoachCopy, useCoachLabels, usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function FolderWorkoutsPage({
  folderId,
  folderName,
  workouts,
  folders,
  availableWorkouts,
  gender,
}: {
  folderId: string;
  folderName: string;
  workouts: PersonalWorkoutListItem[];
  folders: { id: string; name: string }[];
  availableWorkouts: WorkoutPickItem[];
  gender?: string | null;
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
      onConfirm: () => {
        startTransition(async () => {
          await deletePersonalWorkoutPlan(planId);
          router.refresh();
        });
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
        <ul className="space-y-3">
          {workouts.map((item) => (
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
    </div>
  );
}
