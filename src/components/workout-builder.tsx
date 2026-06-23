"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  createWorkoutPlan,
  saveWorkoutDay,
  assignWorkoutPlan,
} from "@/lib/actions/plans";
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
}: {
  planId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialDays?: (Day & { day_index: number; id?: string })[];
  clientId?: string;
  requestId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [planId, setPlanId] = useState(initialPlanId);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [days, setDays] = useState<Day[]>(
    initialDays.length > 0
      ? initialDays.map((d) => ({
          title: d.title,
          exercises: d.exercises ?? [],
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
  };

  const handleSave = () => {
    startTransition(async () => {
      let currentPlanId = planId;
      if (!currentPlanId) {
        const result = await createWorkoutPlan(title, description);
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
          day.exercises.filter((e) => e.name.trim()),
          day.dayId
        );
      }

      if (clientId && currentPlanId) {
        await assignWorkoutPlan(clientId, currentPlanId, requestId);
        router.push(`/admin/clients/${clientId}`);
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
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      {days.map((day, dayIdx) => (
        <Card key={dayIdx}>
          <CardHeader>
            <Input
              value={day.title}
              onChange={(e) => {
                const updated = [...days];
                updated[dayIdx].title = e.target.value;
                setDays(updated);
              }}
              className="text-lg font-bold"
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {day.exercises.map((ex, exIdx) => (
              <div key={exIdx} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-5">
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
                    onChange={(e) => updateExercise(dayIdx, exIdx, "rest_seconds", parseInt(e.target.value) || 0)}
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
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => addExercise(dayIdx)}>
              <Plus className="mr-1 h-3 w-3" /> Add Exercise
            </Button>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={addDay}>
          <Plus className="mr-2 h-4 w-4" /> Add Day
        </Button>
        <Button onClick={handleSave} disabled={isPending || !title.trim()}>
          {clientId ? "Save & Assign to Client" : "Save Plan"}
        </Button>
      </div>
    </div>
  );
}
