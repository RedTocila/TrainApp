import { requireClient } from "@/lib/actions/auth";
import { getClientWorkoutAssignment } from "@/lib/actions/plans";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function WorkoutPage() {
  const profile = await requireClient();
  const assignment = await getClientWorkoutAssignment(profile.id);
  const plan = assignment?.workout_plans;
  const days = plan?.workout_days?.sort(
    (a: { day_index: number }, b: { day_index: number }) => a.day_index - b.day_index
  ) ?? [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Workout Plan</h1>
          <p className="text-muted-foreground">
            {plan ? plan.title : "No workout plan assigned yet"}
          </p>
        </div>

        {plan ? (
          <div className="space-y-4">
            {plan.description && (
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            )}
            {days.map((day: { id: string; title: string; exercises?: { id: string; name: string; sets: number; reps: string; rest_seconds: number; notes: string | null; order_index: number }[] }) => (
              <Card key={day.id}>
                <CardHeader>
                  <CardTitle>{day.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {day.exercises
                    ?.sort((a, b) => a.order_index - b.order_index)
                    .map((ex) => (
                      <div
                        key={ex.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-4"
                      >
                        <div>
                          <p className="font-semibold">{ex.name}</p>
                          {ex.notes && (
                            <p className="text-sm text-muted-foreground">{ex.notes}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="secondary">{ex.sets} sets</Badge>
                          <Badge variant="outline">{ex.reps} reps</Badge>
                          <Badge variant="outline">{ex.rest_seconds}s rest</Badge>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Apply for a workout plan from your dashboard to get started.
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
