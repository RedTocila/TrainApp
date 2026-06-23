"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Dumbbell } from "lucide-react";
import type { PersonalExerciseLibraryItem } from "@/lib/actions/user-workouts";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function MyExercisesPage({
  initialExercises,
}: {
  initialExercises: PersonalExerciseLibraryItem[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialExercises;
    return initialExercises.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.planTitle.toLowerCase().includes(q) ||
        item.dayTitle.toLowerCase().includes(q)
    );
  }, [initialExercises, query]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search exercises…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Dumbbell className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No exercises yet</p>
            <p className="text-sm text-muted-foreground">
              Create a workout and add exercises to see them here.
            </p>
            <Link href="/dashboard/workout" className="text-sm font-medium text-primary hover:underline">
              Go to My Workouts
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => (
            <li key={`${item.planId}-${item.id}`}>
              <Link href={`/dashboard/workout/${item.planId}/edit`}>
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.planTitle} · {item.dayTitle}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.sets != null && (
                        <Badge variant="secondary">{item.sets} sets</Badge>
                      )}
                      {item.reps != null && (
                        <Badge variant="outline">{item.reps} reps</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
