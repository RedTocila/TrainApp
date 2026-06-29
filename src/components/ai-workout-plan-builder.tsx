"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ChevronDown, Dumbbell, Loader2, PenLine, Play, Sparkles } from "lucide-react";
import {
  applyAiWorkoutPlanAction,
  generateAiWorkoutPlanAction,
} from "@/lib/actions/ai-plan-builder";
import type { AiGeneratedWorkoutPlan } from "@/lib/ai/plan-builder-types";
import { AiPlanProfileSummary } from "@/components/ai-plan-profile-summary";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { ExerciseVideoDialog } from "@/components/exercise-video-dialog";
import { isValidYoutubeUrl } from "@/lib/youtube";

export function AiWorkoutPlanBuilder({
  profile,
  intakeComplete,
}: {
  profile: Profile;
  intakeComplete: boolean;
}) {
  const router = useRouter();
  const [preferences, setPreferences] = useState("");
  const [plan, setPlan] = useState<AiGeneratedWorkoutPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [openDay, setOpenDay] = useState(0);
  const [showEditor, setShowEditor] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [videoPreview, setVideoPreview] = useState<{ title: string; videoUrl: string } | null>(
    null
  );

  const handleGenerate = () => {
    setError(null);
    setApplied(false);
    startTransition(async () => {
      const result = await generateAiWorkoutPlanAction(preferences);
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
                AI creates a weekly split based on your goal, schedule, injuries, and experience
                level. Review everything before applying.
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
                <Label htmlFor="workout-preferences">Extra preferences (optional)</Label>
                <Textarea
                  id="workout-preferences"
                  rows={3}
                  placeholder="e.g. Home gym only, 45 min sessions, no barbell squats, train 4 days…"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                />
              </div>

              <Button className="w-full" onClick={handleGenerate} disabled={isPending}>
                {isPending && !plan ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Building your plan…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {plan ? "Regenerate workout plan" : "Generate workout plan"}
                  </>
                )}
              </Button>

              {error && <p className="text-sm text-red-400">{error}</p>}
            </CardContent>
          </Card>
        </>
      ) : null}

      {plan && !showEditor ? (
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
                          className="rounded-lg bg-secondary/30 px-3 py-2 text-sm"
                        >
                          <p className="font-medium">{ex.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {ex.sets} sets × {ex.reps} · {ex.rest_seconds}s rest
                          </p>
                          {ex.notes && (
                            <p className="mt-1 text-xs text-muted-foreground">{ex.notes}</p>
                          )}
                          {ex.video_url && isValidYoutubeUrl(ex.video_url) && (
                            <button
                              type="button"
                              onClick={() =>
                                setVideoPreview({ title: ex.name, videoUrl: ex.video_url! })
                              }
                              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              <Play className="h-3 w-3" />
                              Watch demo
                            </button>
                          )}
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
      ) : null}

      <ExerciseVideoDialog
        open={videoPreview !== null}
        onClose={() => setVideoPreview(null)}
        videoUrl={videoPreview?.videoUrl ?? ""}
        title={videoPreview?.title ?? "Exercise demo"}
      />
    </div>
  );
}
