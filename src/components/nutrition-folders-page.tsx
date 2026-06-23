"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Folder, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import {
  createNutritionFolder,
  deleteNutritionFolder,
  renameNutritionFolder,
  type NutritionFolderOverview,
} from "@/lib/actions/user-nutrition";
import { UNCATEGORIZED_NUTRITION_FOLDER_ID } from "@/lib/nutrition-folders";
import { CustomPlanButton } from "@/components/trainer-plan-offer-card";
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = () => {
    if (!newFolderName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createNutritionFolder(newFolderName);
      if (result.error) {
        setError(result.error);
      } else {
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
    if (
      !confirm(
        `Delete folder "${folder.name}"? Meal plans inside will move to Unfiled.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      await deleteNutritionFolder(folder.id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black">My Nutrition</h1>
          <p className="text-sm text-muted-foreground">
            Organize day menus into folders — each menu has breakfast, snacks, lunch & dinner
          </p>
        </div>
        {!showNewFolder && (
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/nutrition/meals">
              <Button variant="outline">
                <UtensilsCrossed className="mr-2 h-4 w-4" />
                My meals
              </Button>
            </Link>
            <CustomPlanButton type="diet" requests={planRequests} />
            <Button onClick={() => setShowNewFolder(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New folder
            </Button>
          </div>
        )}
      </div>

      {showNewFolder && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <Input
              placeholder="e.g. Cutting, Bulking, Maintenance"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={isPending || !newFolderName.trim()}>
                Create
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewFolder(false);
                  setNewFolderName("");
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {folders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Folder className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No folders yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a folder like &quot;Cutting&quot; or &quot;Weekend&quot;, then add
                day menus and schedule them on your calendar.
              </p>
            </div>
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

            return (
              <Card key={folder.id} className="group relative">
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleRename(folder.id)
                        }
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleRename(folder.id)}
                          disabled={isPending}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Link
                        href={`/dashboard/nutrition/folder/${folder.id}`}
                        className="flex items-start gap-3"
                      >
                        <div className="rounded-lg bg-primary/10 p-2.5">
                          <Folder className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{folder.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {folder.planCount} day menu
                            {folder.planCount === 1 ? "" : "s"}
                          </p>
                        </div>
                      </Link>
                      {!isUncategorized && (
                        <div className="absolute right-2 top-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
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
                            className="h-8 w-8"
                            disabled={isPending}
                            onClick={() => handleDelete(folder)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
