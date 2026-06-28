"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dumbbell, List, Sparkles } from "lucide-react";
import { AddWorkoutWizard } from "@/components/add-workout-wizard";
import { AppDialog } from "@/components/app-dialog";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { UNCATEGORIZED_FOLDER_ID } from "@/lib/workout-folders";
import { cn } from "@/lib/utils";

function DialogLinkRow({
  href,
  icon: Icon,
  title,
  description,
  onNavigate,
}: {
  href: string;
  icon: typeof Dumbbell;
  title: string;
  description: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-border/60 bg-card/80 p-4 transition-colors",
        "hover:border-border hover:bg-secondary/40"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="font-bold">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

export function ChangeWorkoutDialog({
  open,
  onClose,
  planId,
}: {
  open: boolean;
  onClose: () => void;
  planId?: string | null;
}) {
  const platform = usePlatformCopy();
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <AppDialog
        open={open}
        onClose={onClose}
        title="Change workout"
        description="Pick a program, edit your schedule, or build a new one."
        ariaLabel="Change workout"
        maxWidth="max-w-md"
      >
        <div className="space-y-3 px-5 py-4">
          <DialogLinkRow
            href="/dashboard/workout/workouts"
            icon={List}
            title="All workouts"
            description="Browse programs and schedule a different day."
            onNavigate={onClose}
          />
          {planId ? (
            <DialogLinkRow
              href={`/dashboard/workout/${planId}/edit?tab=schedule`}
              icon={Dumbbell}
              title="Edit schedule"
              description="Change which days run on your calendar."
              onNavigate={onClose}
            />
          ) : null}
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                <Sparkles className="h-5 w-5 text-violet-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{platform.aiUpgrade.aiWorkoutPlan}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Generate a new plan with AI.
                </p>
                <Link
                  href="/dashboard/ai/plans/workout"
                  onClick={onClose}
                  className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-3")}
                >
                  {platform.ai.buildPlan}
                </Link>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Dumbbell className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">Build workout</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Create a program from scratch.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setWizardOpen(true);
                    onClose();
                  }}
                >
                  New workout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AppDialog>
      <AddWorkoutWizard
        open={wizardOpen}
        folderId={UNCATEGORIZED_FOLDER_ID}
        onClose={() => setWizardOpen(false)}
        onComplete={() => {
          setWizardOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
