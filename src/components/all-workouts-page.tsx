"use client";

import Link from "next/link";
import { Calendar, Dumbbell, Pencil } from "lucide-react";
import type { PersonalWorkoutListItem } from "@/lib/actions/user-workouts";
import { resolveWorkoutFolderId } from "@/lib/workout-folders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AllWorkoutsPage({
  workouts,
}: {
  workouts: PersonalWorkoutListItem[];
}) {
  if (workouts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Dumbbell className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No workouts yet</p>
          <p className="text-sm text-muted-foreground">
            Create a folder and add your first workout program.
          </p>
          <Link href="/dashboard/workout">
            <Button size="sm">Go to folders</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {workouts.map(({ plan, days, scheduleSummary }) => {
        const folderId = resolveWorkoutFolderId(plan.folder_id);
        const exerciseCount = days.reduce(
          (sum, day) => sum + (day.exercises?.length ?? 0),
          0
        );

        return (
          <li key={plan.id}>
            <Card>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{plan.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {days.length} day{days.length === 1 ? "" : "s"} · {exerciseCount} exercise
                    {exerciseCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 shrink-0" />
                    {scheduleSummary}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {days.slice(0, 3).map((day) => (
                      <Badge key={day.id} variant="secondary">
                        {day.title}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link href={`/dashboard/workout/folder/${folderId}`}>
                    <Button variant="outline" size="sm">
                      Folder
                    </Button>
                  </Link>
                  <Link href={`/dashboard/workout/${plan.id}/edit`}>
                    <Button size="sm">
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
