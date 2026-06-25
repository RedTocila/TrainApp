"use client";
import { useCoachCopy, useCoachLabels } from "@/components/locale-provider";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Apple,
  Calendar,
  Folder,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import {
  createNutritionFolder,
  deleteNutritionFolder,
  renameNutritionFolder,
  type NutritionFolderOverview,
} from "@/lib/actions/user-nutrition";
import { UNCATEGORIZED_NUTRITION_FOLDER_ID } from "@/lib/nutrition-folders";
import { CustomPlanButton } from "@/components/trainer-plan-offer-card";
import { FlowStep } from "@/components/ai/feature-tile";
import { ProgramFolderCard, ProgramQuickTile } from "@/components/programs/program-tiles";
import { useSarcasticConfirm } from "@/hooks/use-sarcastic-confirm";
import type { PlanRequest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function NutritionFoldersPage({
  folders,
  planRequests = [],
}: {
  folders: NutritionFolderOverview[];
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

  const totalMenus = useMemo(
    () => folders.reduce((sum, f) => sum + f.planCount, 0),
    [folders]
  );

  const handleCreate = () => {
    if (!newFolderName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createNutritionFolder(newFolderName);
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
      const result = await renameNutritionFolder(folderId, editName);
      if (!result.error) {
        setEditingId(null);
        router.refresh();
      }
    });
  };

  const handleDelete = (folder: NutritionFolderOverview) => {
    confirmGiveUp({
      ...coachCopy.deleteNutritionFolder(folder.name),
      onConfirm: async () => {
        await deleteNutritionFolder(folder.id);
        router.refresh();
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15">
          <Apple className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-black">Nutrition</h1>
          <p className="text-xs text-muted-foreground">
            {folders.length} folders · {totalMenus} day menus
          </p>
        </div>
      </div>

      <Card className="border-emerald-500/15 bg-emerald-500/5">
        <CardContent className="flex items-center gap-1 px-3 py-4">
          <FlowStep icon={Folder} label="Folder" active />
          <div className="mb-4 h-px flex-1 bg-border" />
          <FlowStep icon={UtensilsCrossed} label="Day menu" active />
          <div className="mb-4 h-px flex-1 bg-border" />
          <FlowStep icon={Calendar} label="Schedule" active />
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-2">
        <ProgramQuickTile href="/dashboard/nutrition/meals" icon={UtensilsCrossed} label="Meals" accentClass="text-emerald-400" bgClass="bg-emerald-500/10" />
        <ProgramQuickTile href="/dashboard/ai/plans/nutrition" icon={Sparkles} label="AI plan" accentClass="text-primary" bgClass="bg-primary/10" />
        <ProgramQuickTile icon={Plus} label="Folder" onClick={() => setShowNewFolder(true)} />
      </div>

      <div className="flex justify-end">
        <CustomPlanButton type="diet" requests={planRequests} />
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
              New folder
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {folders.map((folder) => {
            const isUncategorized = folder.id === UNCATEGORIZED_NUTRITION_FOLDER_ID;
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
                  href={`/dashboard/nutrition/folder/${folder.id}`}
                  name={folder.name}
                  count={folder.planCount}
                  countLabel={folder.planCount === 1 ? "day menu" : "day menus"}
                  icon={Folder}
                />
                {!isUncategorized && (
                  <div className="absolute right-2 top-2 flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setEditingId(folder.id); setEditName(folder.name); }}
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
                )}
              </div>
            );
          })}
        </div>
      )}
      {giveUpDialog}
    </div>
  );
}
