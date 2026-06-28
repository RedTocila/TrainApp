"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
  applyAiWorkoutDayToDateAction,
  generateAiWorkoutDayAction,
  getAiPlanBuilderProfile,
} from "@/lib/actions/ai-plan-builder";
import type { AiGeneratedWorkoutDay } from "@/lib/ai/plan-builder-types";
import { usePlatformCopy } from "@/components/locale-provider";
import { hasAiAccess } from "@/lib/subscription";
import { buildPricingHref } from "@/lib/pricing-nav";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function AddWorkoutToDayAiPanel({
  dateKey,
  dayLabel,
  onAdded,
}: {
  dateKey: string;
  dayLabel: string;
  onAdded: () => void;
}) {
  const platform = usePlatformCopy();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [workout, setWorkout] = useState<AiGeneratedWorkoutDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [exercisesOpen, setExercisesOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setProfileLoading(true);
    void getAiPlanBuilderProfile().then((result) => {
      if ("profile" in result) setProfile(result.profile);
      setProfileLoading(false);
    });
  }, []);

  const aiAccess = profile ? hasAiAccess(profile) : false;

  const handleGenerate = () => {
    setError(null);
    setApplied(false);
    startTransition(async () => {
      const result = await generateAiWorkoutDayAction(prompt);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setWorkout(result.workout);
      setExercisesOpen(true);
    });
  };

  const handleApply = () => {
    if (!workout) return;
    setError(null);
    startTransition(async () => {
      const result = await applyAiWorkoutDayToDateAction(dateKey, workout);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setApplied(true);
      onAdded();
    });
  };

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
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
            <Sparkles className="h-5 w-5 text-violet-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{platform.aiUpgrade.aiWorkoutPlan}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Describe what you want — AI builds one session for {dayLabel} only.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-day-workout-prompt">What should today&apos;s workout be?</Label>
        <Textarea
          id="ai-day-workout-prompt"
          rows={3}
          placeholder="e.g. 45 min upper body, dumbbells only, focus on chest and triceps…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      <Button className="w-full gap-1.5" onClick={handleGenerate} disabled={isPending}>
        {isPending && !workout ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Building session…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate workout
          </>
        )}
      </Button>

      {workout ? (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/80">
          <div className="border-b border-border/60 px-3 py-2.5">
            <p className="text-sm font-semibold">{workout.title}</p>
            {workout.description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{workout.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setExercisesOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-secondary/40"
          >
            <span>{workout.exercises.length} exercises</span>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", exercisesOpen && "rotate-180")}
            />
          </button>
          {exercisesOpen ? (
            <ul className="space-y-1.5 border-t border-border/60 px-3 py-2">
              {workout.exercises.map((ex) => (
                <li
                  key={ex.name}
                  className="rounded-lg bg-secondary/30 px-2.5 py-2 text-xs"
                >
                  <p className="font-medium">{ex.name}</p>
                  <p className="text-muted-foreground">
                    {ex.sets} sets × {ex.reps} · {ex.rest_seconds}s rest
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2 border-t border-border/60 px-3 py-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isPending || applied}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Regenerate
            </Button>
            <Button size="sm" onClick={handleApply} disabled={isPending || applied}>
              {applied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Added
                </>
              ) : isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add to day"
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
