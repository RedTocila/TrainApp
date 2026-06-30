"use client";

import { Badge } from "@/components/ui/badge";
import type { Exercise } from "@/lib/types";
import { ExerciseDemoPlayer } from "@/components/exercise-demo-player";
import { resolveProfileGender, type ExerciseGender } from "@/lib/exercise-gif";

export function ExerciseCard({
  exercise,
  gender,
}: {
  exercise: Exercise;
  gender?: ExerciseGender | string | null;
}) {
  const resolvedGender = resolveProfileGender(gender);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{exercise.name}</p>
          {exercise.notes && (
            <p className="mt-1 text-sm text-muted-foreground">{exercise.notes}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{exercise.sets} sets</Badge>
          <Badge variant="outline">{exercise.reps} reps</Badge>
          <Badge variant="outline">{exercise.rest_seconds}s rest</Badge>
        </div>
      </div>
      <ExerciseDemoPlayer
        name={exercise.name}
        imageUrl={exercise.image_url}
        videoUrl={exercise.video_url}
        gender={resolvedGender}
      />
    </div>
  );
}
