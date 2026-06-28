"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useSelectedDate } from "@/components/date-provider";
import { useOptionalDashboardEnrichment } from "@/components/dashboard-enrichment-provider";
import { usePlatformCopy } from "@/components/locale-provider";
import { WorkoutDifficultyExplainDialog } from "@/components/workout-difficulty-explain-dialog";
import {
  assessPersonalWorkoutDifficulty,
  type WorkoutDifficultyInput,
} from "@/lib/workout-difficulty";
import { buildWorkoutDifficultyBehaviorContext } from "@/lib/workout-difficulty-behavior";
import {
  DIFFICULTY_BUTTON_STYLES,
  DIFFICULTY_ICONS,
  DIFFICULTY_PANEL_STYLES,
} from "@/lib/workout-difficulty-ui";
import type { Profile } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";
import { cn } from "@/lib/utils";

function useDifficultyBehaviorContext() {
  const enrichmentCtx = useOptionalDashboardEnrichment();
  const { selectedDate } = useSelectedDate();

  return useMemo(() => {
    if (!enrichmentCtx) return null;
    return buildWorkoutDifficultyBehaviorContext(
      enrichmentCtx.enrichment,
      formatDateKey(selectedDate)
    );
  }, [enrichmentCtx, selectedDate]);
}

function useDifficultyInsight(
  exercises: WorkoutDifficultyInput[],
  intakeProfile?: Pick<Profile, "age" | "intake_responses"> | null
) {
  const platform = usePlatformCopy();
  const [open, setOpen] = useState(false);
  const behaviorContext = useDifficultyBehaviorContext();
  const { selectedDate } = useSelectedDate();
  const dateKey = formatDateKey(selectedDate);

  const assessment = assessPersonalWorkoutDifficulty(
    exercises,
    intakeProfile,
    behaviorContext
  );
  const difficulty = platform.workout.personalDifficulty[assessment.id];
  const DifficultyIcon = DIFFICULTY_ICONS[assessment.id];

  return {
    platform,
    open,
    setOpen,
    assessment,
    difficulty,
    DifficultyIcon,
    behaviorContext,
    dateKey,
    buttonStyles: DIFFICULTY_BUTTON_STYLES[assessment.id],
    panelStyles: DIFFICULTY_PANEL_STYLES[assessment.id],
  };
}

export function WorkoutDifficultyInsightButton({
  exercises,
  intakeProfile,
  className,
  size = "default",
}: {
  exercises: WorkoutDifficultyInput[];
  intakeProfile?: Pick<Profile, "age" | "intake_responses"> | null;
  className?: string;
  size?: "default" | "compact";
}) {
  const {
    platform,
    open,
    setOpen,
    assessment,
    difficulty,
    DifficultyIcon,
    behaviorContext,
    dateKey,
    buttonStyles,
  } = useDifficultyInsight(exercises, intakeProfile);

  const compact = size === "compact";

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "inline-flex w-fit shrink-0 items-center rounded-full border transition-colors",
          compact ? "gap-1 py-0.5 pl-0.5 pr-1.5" : "gap-1.5 py-1 pl-1.5 pr-2.5",
          buttonStyles.ring,
          className
        )}
        aria-label={`${platform.workout.difficultyForYou}: ${difficulty.label}. ${platform.workout.tapToSeeWhy}`}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-background/40",
            compact ? "h-5 w-5" : "h-7 w-7"
          )}
        >
          <DifficultyIcon
            className={cn(compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5", buttonStyles.icon)}
          />
        </span>
        <span
          className={cn(
            "whitespace-nowrap font-black uppercase tracking-wide",
            compact ? "text-[10px] leading-none" : "text-sm",
            buttonStyles.icon
          )}
        >
          {difficulty.label}
        </span>
      </button>

      <WorkoutDifficultyExplainDialog
        open={open}
        onClose={() => setOpen(false)}
        exercises={exercises}
        behaviorContext={behaviorContext}
        dateKey={dateKey}
        difficultyId={assessment.id}
        workoutLoad={assessment.workoutLoad}
        clientCapacity={assessment.clientCapacity}
        reasons={assessment.reasons}
        hasIntake={assessment.hasIntake}
      />
    </>
  );
}

export function WorkoutDifficultyInsightBanner({
  exercises,
  intakeProfile,
  className,
}: {
  exercises: WorkoutDifficultyInput[];
  intakeProfile?: Pick<Profile, "age" | "intake_responses"> | null;
  className?: string;
}) {
  const {
    platform,
    open,
    setOpen,
    assessment,
    difficulty,
    DifficultyIcon,
    behaviorContext,
    dateKey,
    panelStyles,
  } = useDifficultyInsight(exercises, intakeProfile);

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors hover:brightness-110",
          panelStyles.panel,
          className
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/40",
            panelStyles.icon
          )}
        >
          <DifficultyIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {platform.workout.difficultyForYou}
          </p>
          <p className={cn("text-base font-black uppercase tracking-wide", panelStyles.label)}>
            {difficulty.label}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{difficulty.tagline}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <WorkoutDifficultyExplainDialog
        open={open}
        onClose={() => setOpen(false)}
        exercises={exercises}
        behaviorContext={behaviorContext}
        dateKey={dateKey}
        difficultyId={assessment.id}
        workoutLoad={assessment.workoutLoad}
        clientCapacity={assessment.clientCapacity}
        reasons={assessment.reasons}
        hasIntake={assessment.hasIntake}
      />
    </>
  );
}
