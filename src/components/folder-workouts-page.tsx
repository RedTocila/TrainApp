"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [items, setItems] = useState(workouts);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();

  useEffect(() => {
    setItems(workouts);
  }, [workouts]);

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
              {platform.workout.programsCount(items.length)}
            </p>
          </div>
        </div>
        <AddToFolderMenu
          folderId={folderId}
          folderName={folderName}
          availableWorkouts={availableWorkouts}
        />
      </div>

      {items.length === 0 ? (
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
          {items.map((item) => (
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
    </div>
  );
}
