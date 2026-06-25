"use client";
import { useCoachCopy, useCoachLabels } from "@/components/locale-provider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Calendar,
  Dumbbell,
  Folder,
  HeartPulse,
  Library,
  List,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  createWorkoutFolder,
  deleteWorkoutFolder,
  renameWorkoutFolder,
  type WorkoutFolderOverview,
} from "@/lib/actions/user-workouts";
import { CustomPlanButton } from "@/components/trainer-plan-offer-card";
import { FlowStep } from "@/components/ai/feature-tile";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import { ProgramFolderCard, ProgramQuickTile } from "@/components/programs/program-tiles";
import type { PlanRequest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function WorkoutFoldersPage({
  folders,
  planRequests = [],
}: {
  folders: WorkoutFolderOverview[];
  planRequests?: PlanRequest[];
}) {
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmGiveUp, dialog: giveUpDialog } = useSarcasticConfirm();
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const totalWorkouts = useMemo(
    () => folders.reduce((sum, f) => sum + f.workoutCount, 0),
    [folders]
  );

  const handleCreate = () => {
    if (!newFolderName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createWorkoutFolder(newFolderName);
      if (result.error) setError(result.error);
      else {
        setNewFolderName("");
        setShowNewFolder(false);
        router.refresh();
      }
    });
  };

  const handleRename = (folderId: string) => {
    if (!editName.trim()) return;
    startTransition(async () => {
      const result = await renameWorkoutFolder(folderId, editName);
      if (!result.error) {
        setEditingId(null);
        router.refresh();
      }
    });
  };

  const handleDelete = (folder: WorkoutFolderOverview) => {
    confirmGiveUp({
      ...coachCopy.deleteWorkoutFolder(folder.name),
      onConfirm: async () => {
        await deleteWorkoutFolder(folder.id);
        router.refresh();
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
          <Dumbbell className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-black">Workouts</h1>
          <p className="text-xs text-muted-foreground">
            {folders.length} folders · {totalWorkouts} programs
          </p>
        </div>
      </div>

      <Card className="border-primary/15 bg-primary/5">
        <CardContent className="flex items-center gap-1 px-3 py-4">
          <FlowStep icon={Folder} label="Folder" active />
          <div className="mb-4 h-px flex-1 bg-border" />
          <FlowStep icon={Dumbbell} label="Program" active />
          <div className="mb-4 h-px flex-1 bg-border" />
          <FlowStep icon={Calendar} label="Schedule" active />
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        <ProgramQuickTile href="/dashboard/workout/cardio" icon={HeartPulse} label="Cardio" accentClass="text-orange-400" bgClass="bg-orange-500/10" />
        <ProgramQuickTile href="/dashboard/workout/workouts" icon={List} label="All" />
        <ProgramQuickTile href="/dashboard/workout/exercises" icon={Library} label="Exercises" accentClass="text-violet-400" bgClass="bg-violet-500/10" />
        <ProgramQuickTile href="/dashboard/ai/plans/workout" icon={Sparkles} label="AI plan" accentClass="text-primary" bgClass="bg-primary/10" />
        <ProgramQuickTile icon={Plus} label="Folder" onClick={() => setShowNewFolder(true)} />
      </div>

      <div className="flex justify-end">
        <CustomPlanButton type="workout" requests={planRequests} />
      </div>

      {showNewFolder && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={isPending || !newFolderName.trim()}>
                Create
              </Button>
              <Button variant="outline" onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {folders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Folder className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">{coachLabels.noFolders}</p>
            <Button onClick={() => setShowNewFolder(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {coachLabels.newFolder}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {folders.map((folder) => {
            const isEditing = editingId === folder.id;

            if (isEditing) {
              return (
                <Card key={folder.id}>
                  <CardContent className="space-y-3 p-4">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRename(folder.id)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleRename(folder.id)} disabled={isPending}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <div key={folder.id} className="group relative">
                <ProgramFolderCard
                  href={`/dashboard/workout/folder/${folder.id}`}
                  name={folder.name}
                  count={folder.workoutCount}
                  countLabel={folder.workoutCount === 1 ? "workout" : "workouts"}
                  icon={Folder}
                />
                <div className="absolute right-2 top-2 flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditingId(folder.id);
                      setEditName(folder.name);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={isPending}
                    onClick={() => handleDelete(folder)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {giveUpDialog}
    </div>
  );
}
