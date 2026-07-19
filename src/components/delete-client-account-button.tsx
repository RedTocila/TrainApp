"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { AppDialog } from "@/components/app-dialog";
import { deleteClientAccount } from "@/lib/actions/admin-clients";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DeleteClientAccountButton({
  clientId,
  clientName,
  variant = "outline",
  size = "sm",
  className,
}: {
  clientId: string;
  clientName: string;
  variant?: "outline" | "destructive" | "ghost";
  size?: "sm" | "default" | "icon";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const confirmDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteClientAccount(clientId);
        setOpen(false);
        router.push("/admin/clients");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete account.");
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(
          "gap-1.5",
          variant === "outline" && "border-destructive/40 text-destructive hover:bg-destructive/10",
          className
        )}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setError(null);
          setOpen(true);
        }}
        aria-label={`Delete ${clientName}`}
      >
        {size === "icon" ? (
          <Trash2 className="h-4 w-4" />
        ) : (
          <>
            <Trash2 className="h-3.5 w-3.5" />
            Delete account
          </>
        )}
      </Button>

      <AppDialog
        open={open}
        onClose={() => {
          if (!isPending) setOpen(false);
        }}
        title="Delete client account?"
        description={`This permanently deletes ${clientName}'s account, login, and related data. This cannot be undone.`}
        maxWidth="max-w-md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={confirmDelete}
            >
              {isPending ? "Deleting…" : "Delete permanently"}
            </Button>
          </div>
        }
      >
        {error ? (
          <p className="px-5 pb-2 text-sm text-destructive">{error}</p>
        ) : (
          <p className="px-5 pb-2 text-sm text-muted-foreground">
            Subscriptions, meals, workouts, and progress linked to this client will be removed.
          </p>
        )}
      </AppDialog>
    </>
  );
}
