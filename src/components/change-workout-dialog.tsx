"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dumbbell, List, Sparkles, type LucideIcon } from "lucide-react";
import { AddWorkoutWizard } from "@/components/add-workout-wizard";
import { AppDialog } from "@/components/app-dialog";
import { usePlatformCopy } from "@/components/locale-provider";
import { UNCATEGORIZED_FOLDER_ID } from "@/lib/workout-folders";
import { cn } from "@/lib/utils";

function OptionSquare({
  href,
  icon: Icon,
  title,
  onNavigate,
  accent = "primary",
}: {
  href?: string;
  icon: LucideIcon;
  title: string;
  onNavigate?: () => void;
  accent?: "primary" | "violet" | "emerald";
}) {
  const accents = {
    primary: {
      border: "border-primary/30 hover:border-primary/55",
      wash: "from-primary/18",
      glow: "bg-primary/25",
      well: "bg-primary/15 text-primary",
    },
    violet: {
      border: "border-violet-500/30 hover:border-violet-400/55",
      wash: "from-violet-500/18",
      glow: "bg-violet-400/25",
      well: "bg-violet-500/15 text-violet-400",
    },
    emerald: {
      border: "border-emerald-500/30 hover:border-emerald-400/55",
      wash: "from-emerald-500/18",
      glow: "bg-emerald-400/25",
      well: "bg-emerald-500/15 text-emerald-400",
    },
  }[accent];

  const className = cn(
    "group relative flex min-h-[7.5rem] flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl border bg-card p-3 shadow-sm",
    "transition-[transform,border-color] duration-200 active:scale-[0.98]",
    accents.border
  );

  const inner = (
    <>
      <div
        aria-hidden
        className={cn("absolute inset-0 bg-gradient-to-br via-card to-card", accents.wash)}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-4 -top-5 h-16 w-16 rounded-full blur-2xl",
          accents.glow
        )}
      />
      <span
        className={cn(
          "relative z-10 flex h-11 w-11 items-center justify-center rounded-full",
          accents.well
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="relative z-10 text-center text-[12px] font-bold leading-tight">
        {title}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={onNavigate} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onNavigate} className={className}>
      {inner}
    </button>
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
        title={platform.workout.changeWorkout}
        ariaLabel={platform.workout.changeWorkoutAria}
        maxWidth="max-w-md"
      >
        <div className="grid grid-cols-2 gap-2.5 px-5 py-4 sm:grid-cols-3">
          <OptionSquare
            href="/dashboard/workout/workouts"
            icon={List}
            title={platform.workout.allWorkoutsBrowse}
            onNavigate={onClose}
            accent="primary"
          />
          {planId ? (
            <OptionSquare
              href={`/dashboard/workout/${planId}/edit?tab=schedule`}
              icon={Dumbbell}
              title={platform.workout.editSchedule}
              onNavigate={onClose}
              accent="emerald"
            />
          ) : null}
          <OptionSquare
            href="/dashboard/ai/plans/workout"
            icon={Sparkles}
            title={platform.aiUpgrade.aiWorkoutPlan}
            onNavigate={onClose}
            accent="violet"
          />
          <OptionSquare
            icon={Dumbbell}
            title={platform.workout.createNew}
            onNavigate={() => {
              onClose();
              setWizardOpen(true);
            }}
            accent="primary"
          />
        </div>
      </AppDialog>

      <AddWorkoutWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        folderId={UNCATEGORIZED_FOLDER_ID}
        onComplete={() => {
          setWizardOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
