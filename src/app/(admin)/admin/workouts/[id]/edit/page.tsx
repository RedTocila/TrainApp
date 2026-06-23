import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/actions/auth";
import { getWorkoutPlanWithDetails } from "@/lib/actions/plans";
import { WorkoutBuilder } from "@/components/workout-builder";
import { PageTransition } from "@/components/page-transition";
import type { Exercise } from "@/lib/types";

export default async function EditWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { plan, days } = await getWorkoutPlanWithDetails(id);

  if (!plan) notFound();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Edit Workout Plan</h1>
          <p className="text-muted-foreground">{plan.title}</p>
        </div>
        <WorkoutBuilder
          planId={plan.id}
          initialTitle={plan.title}
          initialDescription={plan.description ?? ""}
          initialDays={days.map((d) => ({
            ...d,
            exercises: d.exercises?.sort((a: Exercise, b: Exercise) => a.order_index - b.order_index) ?? [],
          }))}
        />
      </div>
    </PageTransition>
  );
}
