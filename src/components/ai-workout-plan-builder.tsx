"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, Dumbbell, Loader2, PenLine, Sparkles, Zap } from "lucide-react";
import {
  applyAiWorkoutPlanAction,
  generateAiWorkoutPlanAction,
} from "@/lib/actions/ai-plan-builder";
import type { AiWorkoutPlanResult } from "@/lib/ai/plan-builder-types";
import { isAiHiitPlan } from "@/lib/ai/plan-builder-types";
import { inferAiWorkoutKind } from "@/lib/ai/infer-workout-kind";
import { AiPlanProfileSummary } from "@/components/ai-plan-profile-summary";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { ExerciseGifThumbnail } from "@/components/exercise-gif-thumbnail";
import { resolveProfileGender } from "@/lib/exercise-gif";
import { hiitSummaryLabel } from "@/lib/hiit";

export function AiWorkoutPlanBuilder({
  profile,
  intakeComplete,
}: {
  profile: Profile;
  intakeComplete: boolean;
}) {
  const router = useRouter();
  const [preferences, setPreferences] = useState("");
  const [plan, setPlan] = useState<AiWorkoutPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [openDay, setOpenDay] = useState(0);
  const [showEditor, setShowEditor] = useState(true);
  const [isPending, startTransition] = useTransition();
  const exerciseGender = resolveProfileGender(profile.gender);
  const detectedKind = useMemo(
    () => inferAiWorkoutKind(preferences),
    [preferences]
  );

  const handleGenerate = () => {
    setError(null);
    setApplied(false);
    startTransition(async () => {
      // Detect fitness vs HIIT from what the user wrote.
      const result = await generateAiWorkoutPlanAction(preferences, null);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPlan(result.plan);
      setOpenDay(0);
      setShowEditor(false);
    });
  };

  const handleEditPrompt = () => {
    setError(null);
    setShowEditor(true);
  };

  const handleApply = () => {
    if (!plan) return;
    setError(null);
    startTransition(async () => {
      const result = await applyAiWorkoutPlanAction(plan);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setApplied(true);
      router.push(`/dashboard/workout/${result.planId}/edit`);
    });
  };

  return (
    <div className="space-y-6">
      {showEditor ? (
        <>
          <AiPlanProfileSummary profile={profile} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Dumbbell className="h-4 w-4 text-primary" />
                Build workout plan
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Describe what you want — mention HIIT/intervals or a normal fitness plan with
                sets &amp; reps. AI picks the right builder from your text.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!intakeComplete && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
                  For best results, complete your health profile first. AI will still generate
                  with whatever info you have.
                </p>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="workout-preferences">What should the workout be?</Label>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                      detectedKind === "hiit"
                        ? "bg-fuchsia-500/15 text-fuchsia-300"
                        : "bg-primary/10 text-primary"
                    )}
                  >
                    {detectedKind === "hiit" ? (
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
                  id="workout-preferences"
                  rows={4}
                  placeholder={
                    detectedKind === "hiit"
                      ? "e.g. HIIT ~20 min, low impact, bodyweight only…"
                      : "e.g. Full body fitness, home gym, 45 min, 4 days — or write “HIIT” for intervals…"
                  }
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Tip: write “HIIT”, “tabata”, or “intervals” for a timer session; otherwise you get
                  a sets &amp; reps plan.
                </p>
              </div>

              <Button className="w-full" onClick={handleGenerate} disabled={isPending}>
                {isPending && !plan ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Building your {detectedKind === "hiit" ? "HIIT" : "workout"}…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {plan
                      ? detectedKind === "hiit"
                        ? "Regenerate HIIT workout"
                        : "Regenerate workout plan"
                      : detectedKind === "hiit"
                        ? "Generate HIIT workout"
                        : "Generate workout plan"}
                  </>
                )}
              </Button>

              {error && <p className="text-sm text-red-400">{error}</p>}
            </CardContent>
          </Card>
        </>
      ) : null}

      {plan && !showEditor ? (
        isAiHiitPlan(plan) ? (
          <Card className="border-fuchsia-500/25">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-fuchsia-400" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-fuchsia-400">
                      HIIT
                    </span>
                  </div>
                  <CardTitle className="text-lg">{plan.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <Badge variant="secondary">{hiitSummaryLabel(plan.config)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-xl bg-secondary/40 px-3 py-2">
                  <p className="text-muted-foreground">Prepare</p>
                  <p className="font-bold tabular-nums">{plan.config.prepare_seconds}s</p>
                </div>
                <div className="rounded-xl bg-secondary/40 px-3 py-2">
                  <p className="text-muted-foreground">Rounds</p>
                  <p className="font-bold tabular-nums">{plan.config.rounds}</p>
                </div>
                <div className="rounded-xl bg-secondary/40 px-3 py-2">
                  <p className="text-muted-foreground">Round rest</p>
                  <p className="font-bold tabular-nums">{plan.config.round_rest_seconds}s</p>
                </div>
                <div className="rounded-xl bg-secondary/40 px-3 py-2">
                  <p className="text-muted-foreground">Cycles</p>
                  <p className="font-bold tabular-nums">{plan.config.cycles}</p>
                </div>
              </div>

              <ul className="space-y-2">
                {plan.config.exercises.map((ex) => (
                  <li
                    key={ex.name}
                    className="flex items-start gap-3 rounded-lg bg-secondary/30 px-3 py-2 text-sm"
                  >
                    <ExerciseGifThumbnail
                      name={ex.name}
                      imageUrl={ex.image_url}
                      videoUrl={ex.video_url}
                      gender={exerciseGender}
                      size="lg"
                      expandable
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{ex.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ex.work_seconds}s work · {ex.rest_seconds}s rest
                      </p>
                      {ex.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">{ex.notes}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {plan.coach_notes.length > 0 && (
                <div className="rounded-lg bg-fuchsia-500/5 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-400">
                    Coach notes
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {plan.coach_notes.map((note) => (
                      <li key={note}>• {note}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleEditPrompt} disabled={isPending}>
                  <PenLine className="mr-2 h-4 w-4" />
                  Edit & regenerate
                </Button>
                <Button onClick={handleApply} disabled={isPending || applied}>
                  {applied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Applied
                    </>
                  ) : isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Applying…
                    </>
                  ) : (
                    "Apply to my workouts"
                  )}
                </Button>
                {applied && (
                  <Link
                    href="/dashboard/workout"
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Open workouts
                  </Link>
                )}
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{plan.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <Badge variant="secondary">{plan.days.length} training days</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {plan.days.map((day, index) => (
                  <div key={day.title} className="overflow-hidden rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setOpenDay(openDay === index ? -1 : index)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/40"
                    >
                      <span className="font-semibold">
                        Day {index + 1} · {day.title}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {day.exercises.length} exercises
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            openDay === index && "rotate-180"
                          )}
                        />
                      </span>
                    </button>
                    {openDay === index && (
                      <ul className="space-y-2 border-t border-border px-4 py-3">
                        {day.exercises.map((ex) => (
                          <li
                            key={`${day.title}-${ex.name}`}
                            className="flex items-start gap-3 rounded-lg bg-secondary/30 px-3 py-2 text-sm"
                          >
                            <ExerciseGifThumbnail
                              name={ex.name}
                              imageUrl={ex.image_url}
                              videoUrl={ex.video_url}
                              gender={exerciseGender}
                              size="lg"
                              expandable
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{ex.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {ex.sets} sets × {ex.reps} · {ex.rest_seconds}s rest
                              </p>
                              {ex.notes && (
                                <p className="mt-1 text-xs text-muted-foreground">{ex.notes}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              {plan.coach_notes.length > 0 && (
                <div className="rounded-lg bg-primary/5 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Coach notes
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {plan.coach_notes.map((note) => (
                      <li key={note}>• {note}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleEditPrompt} disabled={isPending}>
                  <PenLine className="mr-2 h-4 w-4" />
                  Edit & regenerate
                </Button>
                <Button onClick={handleApply} disabled={isPending || applied}>
                  {applied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Applied
                    </>
                  ) : isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Applying…
                    </>
                  ) : (
                    "Apply to my workouts"
                  )}
                </Button>
                {applied && (
                  <Link
                    href="/dashboard/workout"
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Open workouts
                  </Link>
                )}
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  );
}
