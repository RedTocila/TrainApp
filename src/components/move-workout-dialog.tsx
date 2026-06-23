"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Folder, FolderInput, X } from "lucide-react";
import { moveWorkoutToFolder } from "@/lib/actions/user-workouts";
import { resolveWorkoutFolderId } from "@/lib/workout-folders";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MoveWorkoutDialogProps {
  open: boolean;
  onClose: () => void;
  planId: string;
  planTitle: string;
  currentFolderId: string | null | undefined;
  folders: { id: string; name: string }[];
  onMoved?: () => void;
}

export function MoveWorkoutDialog({
  open,
  onClose,
  planId,
  planTitle,
  currentFolderId,
  folders,
  onMoved,
}: MoveWorkoutDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = resolveWorkoutFolderId(currentFolderId);
  const destinations = folders.filter((f) => f.id !== current);

  const handleMove = (targetFolderId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await moveWorkoutToFolder(planId, targetFolderId);
      if (result.error) {
        setError(result.error);
      } else {
        onMoved?.();
        router.refresh();
        onClose();
      }
    });
  };

  if (!open) return null;

  return (
    <div className="overlay-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Move workout
            </p>
            <h2 className="text-lg font-black">{planTitle}</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Choose a folder to move this workout into.
          </p>

          {destinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other folders available.</p>
          ) : (
            <div className="space-y-2">
              {destinations.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleMove(folder.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border border-border bg-secondary/60 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/10",
                    isPending && "opacity-60"
                  )}
                >
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Folder className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium">{folder.name}</span>
                </button>
              ))}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}

interface MoveWorkoutButtonProps {
  planId: string;
  planTitle: string;
  currentFolderId: string | null | undefined;
  folders: { id: string; name: string }[];
  onMoved?: () => void;
  size?: "sm" | "default";
}

export function MoveWorkoutButton({
  planId,
  planTitle,
  currentFolderId,
  folders,
  onMoved,
  size = "sm",
}: MoveWorkoutButtonProps) {
  const [open, setOpen] = useState(false);
  const current = resolveWorkoutFolderId(currentFolderId);
  const canMove = folders.some((f) => f.id !== current);

  if (!canMove) return null;

  return (
    <>
      <Button size={size} variant="outline" onClick={() => setOpen(true)}>
        <FolderInput className="mr-1 h-3 w-3" />
        Move
      </Button>
      <MoveWorkoutDialog
        open={open}
        onClose={() => setOpen(false)}
        planId={planId}
        planTitle={planTitle}
        currentFolderId={currentFolderId}
        folders={folders}
        onMoved={onMoved}
      />
    </>
  );
}
