"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  getWorkoutCategoryStyle,
  inferDayCategory,
} from "@/lib/workout-visual-categories";
import { cn } from "@/lib/utils";
import {
  createWorkoutPlan,
  saveWorkoutDay,
  assignWorkoutPlan,
} from "@/lib/actions/plans";
import { sendTrainerPlanToClient } from "@/lib/actions/custom-plans";
import { createPersonalWorkoutPlan, assignPersonalWorkoutPlan } from "@/lib/actions/user-workouts";
import { isValidYoutubeUrl } from "@/lib/youtube";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes?: string;
  video_url?: string;
}

interface Day {
  title: string;
  exercises: Exercise[];
  dayId?: string;
}

export function WorkoutBuilder({
  planId: initialPlanId,
  initialTitle = "",
  initialDescription = "",
  initialDays = [],
  clientId,
  requestId,
  mode = "admin",
  wizard = false,
  onWizardComplete,
  stayOnPage = false,
  onSaved,
  folderId,
}: {
  planId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialDays?: (Day & { day_index: number; id?: string; exercises?: Exercise[] })[];
  clientId?: string;
  requestId?: string;
  mode?: "admin" | "client";
  wizard?: boolean;
  onWizardComplete?: (planId: string) => void;
  stayOnPage?: boolean;
  onSaved?: () => void;
  folderId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [planId, setPlanId] = useState(initialPlanId);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [showDescription, setShowDescription] = useState(!!initialDescription.trim());
  const [openExerciseFields, setOpenExerciseFields] = useState<Set<string>>(() => {
    const open = new Set<string>();
    initialDays.forEach((day, dayIdx) => {
      (day.exercises ?? []).forEach((ex, exIdx) => {
        if (ex.video_url?.trim()) open.add(`${dayIdx}-${exIdx}-video`);
        if (ex.notes?.trim()) open.add(`${dayIdx}-${exIdx}-notes`);
      });
    });
    return open;
  });
  const [days, setDays] = useState<Day[]>(
    initialDays.length > 0
      ? initialDays.map((d) => ({
          title: d.title,
          exercises: (d.exercises ?? []).map((e) => ({
            name: e.name,
            sets: e.sets,
            reps: e.reps,
            rest_seconds: e.rest_seconds,
            notes: e.notes ?? undefined,
            video_url: e.video_url ?? undefined,
          })),
          dayId: d.id,
        }))
      : [{ title: "Day 1", exercises: [{ name: "", sets: 3, reps: "10", rest_seconds: 60 }] }]
  );

  const addDay = () => {
    setDays([
      ...days,
      {
        title: `Day ${days.length + 1}`,
        exercises: [{ name: "", sets: 3, reps: "10", rest_seconds: 60 }],
      },
    ]);
  };

  const updateExercise = (dayIdx: number, exIdx: number, field: keyof Exercise, value: string | number) => {
    const updated = [...days];
    updated[dayIdx].exercises[exIdx] = {
      ...updated[dayIdx].exercises[exIdx],
      [field]: value,
    };
    setDays(updated);
  };

  const addExercise = (dayIdx: number) => {
    const updated = [...days];
    updated[dayIdx].exercises.push({ name: "", sets: 3, reps: "10", rest_seconds: 60 });
    setDays(updated);
  };

  const removeExercise = (dayIdx: number, exIdx: number) => {
    const updated = [...days];
    updated[dayIdx].exercises.splice(exIdx, 1);
    setDays(updated);
    setOpenExerciseFields((current) => {
      const next = new Set<string>();
      for (const key of current) {
        const match = key.match(/^(\d+)-(\d+)-(video|notes)$/);
        if (!match) continue;
        const dIdx = Number(match[1]);
        const eIdx = Number(match[2]);
        const field = match[3];
        if (dIdx !== dayIdx) {
          next.add(key);
        } else if (eIdx < exIdx) {
          next.add(key);
        } else if (eIdx > exIdx) {
          next.add(`${dIdx}-${eIdx - 1}-${field}`);
        }
      }
      return next;
    });
  };

  const toggleExerciseField = (dayIdx: number, exIdx: number, field: "video" | "notes") => {
    const key = `${dayIdx}-${exIdx}-${field}`;
    setOpenExerciseFields((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isExerciseFieldOpen = (dayIdx: number, exIdx: number, field: "video" | "notes") =>
    openExerciseFields.has(`${dayIdx}-${exIdx}-${field}`);

  const handleSave = () => {
    startTransition(async () => {
      let currentPlanId = planId;
      if (!currentPlanId) {
        const result =
          mode === "client"
            ? await createPersonalWorkoutPlan(title, description, folderId)
            : await createWorkoutPlan(title, description);
        if (result.error || !result.data) return;
        currentPlanId = result.data.id;
        setPlanId(currentPlanId);
      }

      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        await saveWorkoutDay(
          currentPlanId!,
          i,
          day.title,
          day.exercises
            .filter((e) => e.name.trim())
            .map((e) => ({
              ...e,
              video_url: e.video_url?.trim() || undefined,
            })),
          day.dayId
        );
      }

      if (clientId && currentPlanId) {
        if (requestId) {
          await sendTrainerPlanToClient(requestId, currentPlanId, "workout");
        } else {
          await assignWorkoutPlan(clientId, currentPlanId, requestId);
        }
        router.push(`/admin/clients/${clientId}`);
      } else if (wizard && currentPlanId && onWizardComplete) {
        onWizardComplete(currentPlanId);
      } else if (mode === "client" && currentPlanId) {
        if (!initialPlanId) {
          await assignPersonalWorkoutPlan(currentPlanId);
        }
        if (stayOnPage) {
          onSaved?.();
        } else {
          router.push("/dashboard/workout");
        }
      } else {
        router.push(`/admin/workouts/${currentPlanId}/edit`);
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 4-Week Strength" />
          </div>
          <div className="space-y-2">
            {showDescription ? (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional description"
                autoFocus={!initialDescription.trim()}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowDescription(true)}
                className="text-sm text-primary hover:underline"
              >
                Add description
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {days.map((day, dayIdx) => {
        const dayCategory = inferDayCategory({
          title: day.title,
          exercises: day.exercises,
        });
        const dayStyle = getWorkoutCategoryStyle(dayCategory);
        const DayIcon = dayStyle.icon;

        return (
        <Card key={dayIdx} className={cn("overflow-hidden border-2", dayStyle.cardBorder)}>
          <div className={cn("h-1.5 w-full", dayStyle.stripe)} aria-hidden />
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                dayStyle.chip,
                dayStyle.chipText
              )}
              title={dayStyle.label}
            >
              <DayIcon className="h-4 w-4" aria-hidden />
            </span>
            <Input
              value={day.title}
              onChange={(e) => {
                const updated = [...days];
                updated[dayIdx].title = e.target.value;
                setDays(updated);
              }}
              className="border-0 bg-transparent px-0 text-lg font-bold shadow-none focus-visible:ring-0"
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {day.exercises.map((ex, exIdx) => (
              <div key={exIdx} className="space-y-2 rounded-lg border border-border p-3">
                <div className="grid gap-2 sm:grid-cols-5">
                  <Input
                    placeholder="Exercise name"
                    value={ex.name}
                    onChange={(e) => updateExercise(dayIdx, exIdx, "name", e.target.value)}
                    className="sm:col-span-2"
                  />
                  <Input
                    type="number"
                    placeholder="Sets"
                    value={ex.sets}
                    onChange={(e) => updateExercise(dayIdx, exIdx, "sets", parseInt(e.target.value) || 0)}
                  />
                  <Input
                    placeholder="Reps"
                    value={ex.reps}
                    onChange={(e) => updateExercise(dayIdx, exIdx, "reps", e.target.value)}
                  />
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      placeholder="Rest (s)"
                      value={ex.rest_seconds}
                      onChange={(e) =>
                        updateExercise(dayIdx, exIdx, "rest_seconds", parseInt(e.target.value) || 0)
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExercise(dayIdx, exIdx)}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {!isExerciseFieldOpen(dayIdx, exIdx, "video") && (
                    <button
                      type="button"
                      onClick={() => toggleExerciseField(dayIdx, exIdx, "video")}
                      className="text-sm text-primary hover:underline"
                    >
                      Add video link
                    </button>
                  )}
                  {!isExerciseFieldOpen(dayIdx, exIdx, "notes") && (
                    <button
                      type="button"
                      onClick={() => toggleExerciseField(dayIdx, exIdx, "notes")}
                      className="text-sm text-primary hover:underline"
                    >
                      Add notes
                    </button>
                  )}
                </div>
                {isExerciseFieldOpen(dayIdx, exIdx, "video") && (
                  <Input
                    placeholder="YouTube URL — paste a demo video link"
                    value={ex.video_url ?? ""}
                    onChange={(e) => updateExercise(dayIdx, exIdx, "video_url", e.target.value)}
                    className={
                      ex.video_url && !isValidYoutubeUrl(ex.video_url)
                        ? "border-red-500"
                        : undefined
                    }
                    autoFocus={!ex.video_url?.trim()}
                  />
                )}
                {isExerciseFieldOpen(dayIdx, exIdx, "notes") && (
                  <Input
                    placeholder="Notes"
                    value={ex.notes ?? ""}
                    onChange={(e) => updateExercise(dayIdx, exIdx, "notes", e.target.value)}
                    autoFocus={!ex.notes?.trim()}
                  />
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => addExercise(dayIdx)}>
              <Plus className="mr-1 h-3 w-3" /> Add Exercise
            </Button>
          </CardContent>
        </Card>
        );
      })}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={addDay}>
          <Plus className="mr-2 h-4 w-4" /> Add Day
        </Button>
        <Button onClick={handleSave} disabled={isPending || !title.trim()}>
          {wizard
            ? "Next: Schedule"
            : clientId
              ? "Save & Assign to Client"
              : mode === "client"
                ? "Save workout"
                : "Save Plan"}
        </Button>
      </div>
    </div>
  );
}
