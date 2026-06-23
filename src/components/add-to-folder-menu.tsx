"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dumbbell, FolderPlus, Plus, Sparkles, X } from "lucide-react";
import type { WorkoutPickItem } from "@/lib/actions/user-workouts";
import { moveWorkoutToFolder } from "@/lib/actions/user-workouts";
import { AddWorkoutWizard } from "@/components/add-workout-wizard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AddToFolderMenuProps {
  folderId: string;
  folderName: string;
  availableWorkouts: WorkoutPickItem[];
}

export function AddToFolderMenu({
  folderId,
  folderName,
  availableWorkouts,
}: AddToFolderMenuProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [existingOpen, setExistingOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleAddExisting = (planId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await moveWorkoutToFolder(planId, folderId);
      if (result.error) {
        setError(result.error);
      } else {
        setExistingOpen(false);
        setMenuOpen(false);
        router.refresh();
      }
    });
  };

  const openCreate = () => {
    setMenuOpen(false);
    setWizardOpen(true);
  };

  const openExisting = () => {
    setMenuOpen(false);
    setExistingOpen(true);
  };

  return (
    <>
      <Button onClick={() => setMenuOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add workout
      </Button>

      {menuOpen && (
        <div className="overlay-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Add to {folderName}
                </p>
                <h2 className="text-lg font-black">Add workout</h2>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setMenuOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 p-4 sm:p-6">
              <button
                type="button"
                onClick={openCreate}
                className="flex w-full items-start gap-3 rounded-lg border border-border bg-secondary/60 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/10"
              >
                <div className="rounded-lg bg-primary/10 p-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Create new workout</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Build a new program and schedule it
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={openExisting}
                disabled={availableWorkouts.length === 0}
                className="flex w-full items-start gap-3 rounded-lg border border-border bg-secondary/60 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="rounded-lg bg-primary/10 p-2">
                  <FolderPlus className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Add existing workout</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {availableWorkouts.length === 0
                      ? "No other workouts to add yet"
                      : `Move a workout from another folder (${availableWorkouts.length} available)`}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {existingOpen && (
        <div className="overlay-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Add to {folderName}
                </p>
                <h2 className="text-lg font-black">Existing workouts</h2>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setExistingOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-y-auto px-4 py-4 sm:px-6">
              <p className="mb-4 text-sm text-muted-foreground">
                Tap a workout to add it to this folder.
              </p>
              <div className="space-y-2">
                {availableWorkouts.map((workout) => (
                  <button
                    key={workout.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAddExisting(workout.id)}
                    className="flex w-full items-start gap-3 rounded-lg border border-border bg-secondary/60 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
                  >
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Dumbbell className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{workout.title}</p>
                      {workout.description && (
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {workout.description}
                        </p>
                      )}
                      <Badge variant="secondary" className="mt-2">
                        In {workout.currentFolderName}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            </div>
          </div>
        </div>
      )}

      <AddWorkoutWizard
        open={wizardOpen}
        folderId={folderId}
        onClose={() => setWizardOpen(false)}
        onComplete={() => {
          setWizardOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
