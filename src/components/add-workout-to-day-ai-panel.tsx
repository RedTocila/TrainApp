"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Check, ChevronDown, Loader2, PenLine, Sparkles } from "lucide-react";
import {
  applyAiFullTrainingDayToDateAction,
  generateAiFullTrainingDayAction,
  getAiPlanBuilderProfile,
} from "@/lib/actions/ai-plan-builder";
import type { AiDayProgramResult } from "@/lib/ai/generate-workout-plan";
import { usePlatformCopy } from "@/components/locale-provider";
import { hasAiAccess } from "@/lib/subscription";
import { buildPricingHref } from "@/lib/pricing-nav";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { ExerciseGifThumbnail } from "@/components/exercise-gif-thumbnail";
import { resolveProfileGender } from "@/lib/exercise-gif";
import { hiitSummaryLabel } from "@/lib/hiit";
import { WorkoutCategoryIcon } from "@/components/programs/workout-day-chip";
import {
  inferWorkoutCategoryFromText,
  type WorkoutCategory,
} from "@/lib/workout-visual-categories";

function categoryForSection(
  tone: "warmup" | "main" | "hiit" | "stretch",
  title: string
): WorkoutCategory {
  if (tone === "warmup") return "warmup";
  if (tone === "stretch") return "stretch";
  if (tone === "hiit") return "hiit";
  return inferWorkoutCategoryFromText(title);
}

export function AddWorkoutToDayAiPanel({
  dateKey,
  onAdded,
  onFooterChange,
}: {
  dateKey: string;
  onAdded: () => void;
  onFooterChange?: (footer: ReactNode | null) => void;
}) {
  const platform = usePlatformCopy();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [program, setProgram] = useState<AiDayProgramResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [openSection, setOpenSection] = useState<"warmup" | "main" | "stretch" | null>(
    "main"
  );
  const [showEditor, setShowEditor] = useState(true);
  const [isGenerating, startGenerate] = useTransition();
  const [isApplying, setIsApplying] = useState(false);
  const exerciseGender = resolveProfileGender(profile?.gender);

  useEffect(() => {
    let cancelled = false;
    void getAiPlanBuilderProfile().then((result) => {
      if (cancelled) return;
      if ("profile" in result) setProfile(result.profile);
      setProfileLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const aiAccess = profile ? hasAiAccess(profile) : false;
  const busy = isGenerating || isApplying;
  const canGenerate = Boolean(prompt.trim()) && !busy;

  const handleGenerate = () => {
    setError(null);
    setApplied(false);
    startGenerate(async () => {
      try {
        const result = await generateAiFullTrainingDayAction(prompt);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setProgram(result.program);
        setOpenSection("main");
        setShowEditor(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to generate training day"
        );
      }
    });
  };

  const handleEditPrompt = useEffectEvent(() => {
    setError(null);
    setShowEditor(true);
    onFooterChange?.(null);
  });

  const handleApply = useEffectEvent(() => {
    if (!program || isApplying || applied) return;
    setError(null);
    setIsApplying(true);
    void (async () => {
      try {
        const result = await applyAiFullTrainingDayToDateAction(dateKey, program);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setApplied(true);
        onAdded();
        window.setTimeout(() => {
          onFooterChange?.(null);
        }, 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add training day");
      } finally {
        setIsApplying(false);
      }
    })();
  });

  useEffect(() => {
    if (!onFooterChange) return;
    if (!program || showEditor) {
      onFooterChange(null);
      return;
    }

    onFooterChange(
      <div className="relative z-30 flex w-full flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleEditPrompt()}
          disabled={busy || applied}
        >
          <PenLine className="mr-1.5 h-3.5 w-3.5" />
          Edit & regenerate
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => handleApply()}
          disabled={busy || applied}
        >
          {applied ? (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              {platform.common.done}
            </>
          ) : isApplying ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              {platform.common.saving}
            </>
          ) : (
            platform.workout.addFullDay
          )}
        </Button>
      </div>
    );

    return () => onFooterChange(null);
  }, [
    program,
    showEditor,
    busy,
    applied,
    isApplying,
    onFooterChange,
    platform.common.done,
    platform.common.saving,
    platform.workout.addFullDay,
  ]);

  if (profileLoading) {
    return <p className="text-sm text-muted-foreground">{platform.common.loading}</p>;
  }

  if (!aiAccess) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
          <Sparkles className="h-5 w-5 text-violet-400" />
        </div>
        <p className="mt-3 font-bold">{platform.aiUpgrade.aiWorkoutPlan}</p>
        <p className="mt-1 text-sm text-muted-foreground">{platform.aiUpgrade.unlockFeature}</p>
        <Link
          href={buildPricingHref(pathname)}
          className={cn(buttonVariants({ size: "sm" }), "mt-3")}
        >
          {platform.aiUpgrade.viewAiPlan}
        </Link>
      </div>
    );
  }

  const mainTitle =
    program?.main.kind === "hiit"
      ? program.main.plan.title
      : program?.main.workout.title ?? "";
  const mainSummary =
    program?.main.kind === "hiit"
      ? hiitSummaryLabel(program.main.plan.config)
      : platform.common.exercises(program?.main.workout.exercises.length ?? 0);
  const mainExerciseCount =
    program?.main.kind === "hiit"
      ? program.main.plan.config.exercises.length
      : program?.main.workout.exercises.length ?? 0;

  return (
    <div className="space-y-4">
      {showEditor ? (
        <>
          <div className="relative">
            <Textarea
              id="ai-day-workout-prompt"
              rows={2}
              placeholder={platform.workout.aiFullDayPlaceholder}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={busy}
              className="min-h-0 resize-none rounded-2xl pb-12 pr-12"
            />
            <Button
              type="button"
              size="icon"
              className="absolute bottom-2 right-2 h-10 w-10 rounded-full shadow-md shadow-primary/25"
              onClick={handleGenerate}
              disabled={!canGenerate}
              aria-label={
                program
                  ? platform.workout.regenerateWorkout
                  : platform.workout.generateFullDay
              }
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </>
      ) : null}

      {program && !showEditor ? (
        <ul className="space-y-2">
          <li>
            <ProgramSection
              open={openSection === "warmup"}
              onToggle={() =>
                setOpenSection((cur) => (cur === "warmup" ? null : "warmup"))
              }
              category={categoryForSection("warmup", program.warmup.title)}
              sessionLabel={platform.workout.sessionTypeWarmup}
              title={program.warmup.title}
              summary={hiitSummaryLabel(program.warmup.config)}
              exerciseCount={program.warmup.config.exercises.length}
              exercisesLabel={platform.common.exercises}
              applied={applied}
              addedLabel={platform.workout.workoutAddedToDay}
            >
              {program.warmup.config.exercises.map((ex) => (
                <li
                  key={ex.name}
                  className="flex items-start gap-2.5 rounded-xl border border-border/35 bg-secondary/35 px-2.5 py-2 text-xs"
                >
                  <ExerciseGifThumbnail
                    name={ex.name}
                    imageUrl={ex.image_url}
                    videoUrl={ex.video_url}
                    gender={exerciseGender}
                    size="sm"
                    expandable
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{ex.name}</p>
                    <p className="text-muted-foreground">
                      {ex.work_seconds}s work · {ex.rest_seconds}s rest
                    </p>
                  </div>
                </li>
              ))}
            </ProgramSection>
          </li>

          <li>
            <ProgramSection
              open={openSection === "main"}
              onToggle={() =>
                setOpenSection((cur) => (cur === "main" ? null : "main"))
              }
              category={categoryForSection(
                program.main.kind === "hiit" ? "hiit" : "main",
                mainTitle
              )}
              sessionLabel={
                program.main.kind === "hiit"
                  ? "HIIT"
                  : platform.workout.sessionTypeMain
              }
              title={mainTitle}
              summary={mainSummary}
              exerciseCount={mainExerciseCount}
              exercisesLabel={platform.common.exercises}
              applied={applied}
              addedLabel={platform.workout.workoutAddedToDay}
            >
              {program.main.kind === "hiit"
                ? program.main.plan.config.exercises.map((ex) => (
                    <li
                      key={ex.name}
                      className="flex items-start gap-2.5 rounded-xl border border-border/35 bg-secondary/35 px-2.5 py-2 text-xs"
                    >
                      <ExerciseGifThumbnail
                        name={ex.name}
                        imageUrl={ex.image_url}
                        videoUrl={ex.video_url}
                        gender={exerciseGender}
                        size="sm"
                        expandable
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{ex.name}</p>
                        <p className="text-muted-foreground">
                          {ex.work_seconds}s work · {ex.rest_seconds}s rest
                        </p>
                      </div>
                    </li>
                  ))
                : program.main.workout.exercises.map((ex) => (
                    <li
                      key={ex.name}
                      className="flex items-start gap-2.5 rounded-xl border border-border/35 bg-secondary/35 px-2.5 py-2 text-xs"
                    >
                      <ExerciseGifThumbnail
                        name={ex.name}
                        imageUrl={ex.image_url}
                        videoUrl={ex.video_url}
                        gender={exerciseGender}
                        size="sm"
                        expandable
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{ex.name}</p>
                        <p className="text-muted-foreground">
                          {ex.sets} sets × {ex.reps} · {ex.rest_seconds}s rest
                        </p>
                      </div>
                    </li>
                  ))}
            </ProgramSection>
          </li>

          <li>
            <ProgramSection
              open={openSection === "stretch"}
              onToggle={() =>
                setOpenSection((cur) => (cur === "stretch" ? null : "stretch"))
              }
              category={categoryForSection("stretch", program.stretch.title)}
              sessionLabel={platform.workout.sessionTypeStretch}
              title={program.stretch.title}
              summary={hiitSummaryLabel(program.stretch.config)}
              exerciseCount={program.stretch.config.exercises.length}
              exercisesLabel={platform.common.exercises}
              applied={applied}
              addedLabel={platform.workout.workoutAddedToDay}
            >
              {program.stretch.config.exercises.map((ex) => (
                <li
                  key={ex.name}
                  className="flex items-start gap-2.5 rounded-xl border border-border/35 bg-secondary/35 px-2.5 py-2 text-xs"
                >
                  <ExerciseGifThumbnail
                    name={ex.name}
                    imageUrl={ex.image_url}
                    videoUrl={ex.video_url}
                    gender={exerciseGender}
                    size="sm"
                    expandable
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{ex.name}</p>
                    <p className="text-muted-foreground">
                      {ex.work_seconds}s work · {ex.rest_seconds}s rest
                    </p>
                  </div>
                </li>
              ))}
            </ProgramSection>
          </li>

          {error ? (
            <li>
              <p className="text-sm text-red-400">{error}</p>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function ProgramSection({
  open,
  onToggle,
  category,
  sessionLabel,
  title,
  summary,
  exerciseCount,
  exercisesLabel,
  applied,
  addedLabel,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  category: WorkoutCategory;
  sessionLabel: string;
  title: string;
  summary: string;
  exerciseCount: number;
  exercisesLabel: (n: number) => string;
  applied?: boolean;
  addedLabel: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border transition-colors",
        applied
          ? "border-emerald-500/40 bg-emerald-500/12"
          : "border-border/45 bg-secondary/45"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-secondary/35"
      >
        <WorkoutCategoryIcon category={category} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug">{title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {sessionLabel}
            {summary ? ` · ${summary}` : ""}
            {exerciseCount > 0 ? ` · ${exercisesLabel(exerciseCount)}` : ""}
          </p>
        </div>
        {applied ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
            <Check className="h-3 w-3" strokeWidth={2.5} />
            {addedLabel}
          </span>
        ) : (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        )}
      </button>
      {open ? (
        <ul className="space-y-1.5 border-t border-border/40 px-3 pb-3 pt-2">
          {children}
        </ul>
      ) : null}
    </div>
  );
}
