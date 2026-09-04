"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronDown,
  Dumbbell,
  Flame,
  Loader2,
  PenLine,
  PersonStanding,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  applyAiFullTrainingDayToDateAction,
  generateAiFullTrainingDayAction,
  getAiPlanBuilderProfile,
} from "@/lib/actions/ai-plan-builder";
import type { AiDayProgramResult } from "@/lib/ai/generate-workout-plan";
import { inferAiMainWorkoutKind } from "@/lib/ai/infer-workout-kind";
import { usePlatformCopy } from "@/components/locale-provider";
import { hasAiAccess } from "@/lib/subscription";
import { buildPricingHref } from "@/lib/pricing-nav";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { ExerciseGifThumbnail } from "@/components/exercise-gif-thumbnail";
import { resolveProfileGender } from "@/lib/exercise-gif";
import { hiitSummaryLabel } from "@/lib/hiit";

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
  const detectedMainKind = useMemo(
    () => inferAiMainWorkoutKind(prompt),
    [prompt]
  );

  useEffect(() => {
    setProfileLoading(true);
    void getAiPlanBuilderProfile().then((result) => {
      if ("profile" in result) setProfile(result.profile);
      setProfileLoading(false);
    });
  }, []);

  const aiAccess = profile ? hasAiAccess(profile) : false;
  const busy = isGenerating || isApplying;

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

  const handleEditPrompt = () => {
    setError(null);
    setShowEditor(true);
    onFooterChange?.(null);
  };

  const handleApply = () => {
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
  };

  const handleEditPromptRef = useRef(handleEditPrompt);
  const handleApplyRef = useRef(handleApply);
  handleEditPromptRef.current = handleEditPrompt;
  handleApplyRef.current = handleApply;

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
          onClick={() => handleEditPromptRef.current()}
          disabled={busy || applied}
        >
          <PenLine className="mr-1.5 h-3.5 w-3.5" />
          Edit & regenerate
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => handleApplyRef.current()}
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

  return (
    <div className="space-y-4">
      {showEditor ? (
        <>
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-card p-4 shadow-sm">
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-violet-500/18 via-card to-card"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-violet-400/25 blur-2xl"
            />
            <div className="relative z-10 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="font-bold">{platform.workout.aiFullDayTitle}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="ai-day-workout-prompt">
                {platform.workout.aiFullDayPromptLabel}
              </Label>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                  detectedMainKind === "hiit"
                    ? "bg-fuchsia-500/15 text-fuchsia-300"
                    : "bg-primary/10 text-primary"
                )}
              >
                {detectedMainKind === "hiit" ? (
                  <>
                    <Zap className="h-3 w-3" />
                    HIIT
                  </>
                ) : (
                  <>
                    <Dumbbell className="h-3 w-3" />
                    Fitness
                  </>
                )}
              </span>
            </div>
            <Textarea
              id="ai-day-workout-prompt"
              rows={3}
              placeholder={platform.workout.aiFullDayPlaceholder}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <Button
            type="button"
            className="h-11 w-full gap-1.5 rounded-full shadow-[0_0_14px_rgba(var(--primary-rgb),0.3)]"
            onClick={handleGenerate}
            disabled={busy}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {platform.workout.buildingFullDay}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {program
                  ? platform.workout.regenerateWorkout
                  : platform.workout.generateFullDay}
              </>
            )}
          </Button>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </>
      ) : null}

      {program && !showEditor ? (
        <div className="space-y-2">
          <ProgramSection
            id="warmup"
            open={openSection === "warmup"}
            onToggle={() =>
              setOpenSection((cur) => (cur === "warmup" ? null : "warmup"))
            }
            tone="warmup"
            icon={Flame}
            label={platform.workout.sessionTypeWarmup}
            title={program.warmup.title}
            summary={hiitSummaryLabel(program.warmup.config)}
            exerciseCount={program.warmup.config.exercises.length}
            exercisesLabel={platform.common.exercises}
          >
            {program.warmup.config.exercises.map((ex) => (
              <li
                key={ex.name}
                className="flex items-start gap-2.5 rounded-lg bg-secondary/30 px-2.5 py-2 text-xs"
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

          <ProgramSection
            id="main"
            open={openSection === "main"}
            onToggle={() =>
              setOpenSection((cur) => (cur === "main" ? null : "main"))
            }
            tone={program.main.kind === "hiit" ? "hiit" : "main"}
            icon={program.main.kind === "hiit" ? Zap : Dumbbell}
            label={
              program.main.kind === "hiit"
                ? "HIIT"
                : platform.workout.sessionTypeMain
            }
            title={
              program.main.kind === "hiit"
                ? program.main.plan.title
                : program.main.workout.title
            }
            summary={
              program.main.kind === "hiit"
                ? hiitSummaryLabel(program.main.plan.config)
                : platform.common.exercises(program.main.workout.exercises.length)
            }
            exerciseCount={
              program.main.kind === "hiit"
                ? program.main.plan.config.exercises.length
                : program.main.workout.exercises.length
            }
            exercisesLabel={platform.common.exercises}
          >
            {program.main.kind === "hiit"
              ? program.main.plan.config.exercises.map((ex) => (
                  <li
                    key={ex.name}
                    className="flex items-start gap-2.5 rounded-lg bg-secondary/30 px-2.5 py-2 text-xs"
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
                    className="flex items-start gap-2.5 rounded-lg bg-secondary/30 px-2.5 py-2 text-xs"
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

          <ProgramSection
            id="stretch"
            open={openSection === "stretch"}
            onToggle={() =>
              setOpenSection((cur) => (cur === "stretch" ? null : "stretch"))
            }
            tone="stretch"
            icon={PersonStanding}
            label={platform.workout.sessionTypeStretch}
            title={program.stretch.title}
            summary={hiitSummaryLabel(program.stretch.config)}
            exerciseCount={program.stretch.config.exercises.length}
            exercisesLabel={platform.common.exercises}
          >
            {program.stretch.config.exercises.map((ex) => (
              <li
                key={ex.name}
                className="flex items-start gap-2.5 rounded-lg bg-secondary/30 px-2.5 py-2 text-xs"
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

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ProgramSection({
  open,
  onToggle,
  tone,
  icon: Icon,
  label,
  title,
  summary,
  exerciseCount,
  exercisesLabel,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  tone: "warmup" | "main" | "hiit" | "stretch";
  icon: typeof Flame;
  label: string;
  title: string;
  summary: string;
  exerciseCount: number;
  exercisesLabel: (n: number) => string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card/80",
        tone === "warmup" && "border-orange-500/25",
        tone === "stretch" && "border-teal-500/25",
        tone === "hiit" && "border-fuchsia-500/25",
        tone === "main" && "border-border/60"
      )}
    >
      <div className="border-b border-border/60 px-3 py-2.5">
        <div
          className={cn(
            "mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide",
            tone === "warmup" && "text-orange-400",
            tone === "stretch" && "text-teal-400",
            tone === "hiit" && "text-fuchsia-400",
            tone === "main" && "text-primary"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
          <span className="font-normal normal-case text-muted-foreground">
            · {summary}
          </span>
        </div>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-secondary/40"
      >
        <span>{exercisesLabel(exerciseCount)}</span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <ul className="space-y-1.5 border-t border-border/60 px-3 py-2">{children}</ul>
      ) : null}
    </div>
  );
}
