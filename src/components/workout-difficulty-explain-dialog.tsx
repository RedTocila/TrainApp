"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Minus, X } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { dashboard } from "@/components/dashboard-ui";
import type {
  PersonalWorkoutDifficultyId,
  WorkoutDifficultyReason,
} from "@/lib/workout-difficulty";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DIFFICULTY_LABEL_CLASS: Record<PersonalWorkoutDifficultyId, string> = {
  easy: "text-emerald-400",
  intermediate: "text-sky-400",
  hard: "text-orange-400",
  impossible: "text-fuchsia-400",
};

export function WorkoutDifficultyExplainDialog({
  open,
  onClose,
  difficultyId,
  workoutLoad,
  clientCapacity,
  reasons,
  hasIntake,
}: {
  open: boolean;
  onClose: () => void;
  difficultyId: PersonalWorkoutDifficultyId;
  workoutLoad: number;
  clientCapacity: number;
  reasons: WorkoutDifficultyReason[];
  hasIntake: boolean;
}) {
  const platform = usePlatformCopy();
  const difficulty = platform.workout.personalDifficulty[difficultyId];
  const reasonCopy = platform.workout.personalDifficultyReasons;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const harderReasons = reasons.filter((reason) => reason.impact === "harder");
  const easierReasons = reasons.filter((reason) => reason.impact === "easier");

  const renderReason = (reason: WorkoutDifficultyReason) => {
    const template = reasonCopy[reason.id as keyof typeof reasonCopy];
    if (!template) return null;
    const text =
      typeof template === "function"
        ? (template as (params: Record<string, string>) => string)(reason.params ?? {})
        : template;

    return (
      <li
        key={`${reason.id}-${reason.impact}`}
        className={cn(dashboard.listRow, "items-start gap-2.5 py-2.5")}
      >
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            reason.impact === "harder"
              ? "bg-orange-500/15 text-orange-400"
              : "bg-emerald-500/15 text-emerald-400"
          )}
        >
          {reason.impact === "harder" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )}
        </span>
        <p className="text-sm leading-relaxed text-foreground">{text}</p>
      </li>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={platform.aria.close}
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={platform.workout.difficultyExplainTitle}
        className="relative z-10 flex max-h-[min(85dvh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {platform.workout.difficultyForYou}
            </p>
            <h2
              className={cn("mt-1 text-lg font-black", DIFFICULTY_LABEL_CLASS[difficultyId])}
            >
              {difficulty.label}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {difficulty.summary}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onClose}
            aria-label={platform.aria.close}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div className="grid grid-cols-2 gap-2">
            <div className={cn(dashboard.tile, "p-3 text-center")}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {platform.workout.difficultyWorkoutLoad}
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums">{workoutLoad}</p>
            </div>
            <div className={cn(dashboard.tile, "p-3 text-center")}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {platform.workout.difficultyYourCapacity}
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums">{clientCapacity}</p>
            </div>
          </div>

          {!hasIntake ? (
            <p className={cn(dashboard.empty, "py-4 text-sm")}>
              {platform.workout.personalDifficultyReasons.incompleteProfile}
            </p>
          ) : null}

          {harderReasons.length > 0 ? (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-orange-400">
                <ArrowUp className="h-3.5 w-3.5" />
                {platform.workout.difficultyHarderFactors}
              </p>
              <ul className="space-y-2">{harderReasons.map(renderReason)}</ul>
            </div>
          ) : null}

          {easierReasons.length > 0 ? (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                <ArrowDown className="h-3.5 w-3.5" />
                {platform.workout.difficultyEasierFactors}
              </p>
              <ul className="space-y-2">{easierReasons.map(renderReason)}</ul>
            </div>
          ) : null}

          {hasIntake && harderReasons.length === 0 && easierReasons.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Minus className="h-4 w-4 shrink-0" />
              {platform.workout.difficultyBalancedProfile}
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
