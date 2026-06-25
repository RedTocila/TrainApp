"use client";
import { useCoachCopy, useCoachLabels } from "@/components/locale-provider";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { SarcasticGiveUpDialog } from "@/components/sarcastic-give-up-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({
  variant = "nav",
  className,
}: {
  variant?: "nav" | "profile";
  className?: string;
}) {
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      await signOut();
    });
  };

  const copy = coachCopy.signOut;

  if (variant === "nav") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            className
          )}
        >
          <LogOut className="h-4 w-4" />
          {coachLabels.giveUp}
        </button>
        <SarcasticGiveUpDialog
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
          isPending={isPending}
          title={copy.title}
          message={copy.message}
          confirmLabel={copy.confirm}
          cancelLabel={copy.cancel}
        />
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn("w-full", className)}
        onClick={() => setOpen(true)}
      >
        <LogOut className="h-4 w-4" />
        {coachLabels.giveUp}
      </Button>
      <SarcasticGiveUpDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        isPending={isPending}
        title={copy.title}
        message={copy.message}
        confirmLabel={copy.confirm}
        cancelLabel={copy.cancel}
      />
    </>
  );
}
