"use client";

import Link from "next/link";
import { Calendar, Dumbbell, Pencil, Play } from "lucide-react";
import type { PersonalWorkoutListItem } from "@/lib/actions/user-workouts";
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
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <Dumbbell className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No workouts yet</p>
          <Link href="/dashboard/workout/new">
            <Button size="sm">Create a workout</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {workouts.map(({ plan, days, scheduleSummary }) => {
        const exerciseCount = days.reduce(
          (sum, day) => sum + (day.exercises?.length ?? 0),
          0
        );

        return (
          <li key={plan.id}>
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{plan.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {days.length}d · {exerciseCount} ex
                      </Badge>
                    </div>
                  </div>
                  <Link href={`/dashboard/workout/${plan.id}/edit`}>
                    <Button size="icon" variant="outline" className="h-8 w-8">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {scheduleSummary}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {days.slice(0, 4).map((day) => (
                    <span
                      key={day.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-secondary/50 px-2 py-1 text-[11px]"
                    >
                      <Play className="h-3 w-3 text-primary" />
                      {day.title}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
