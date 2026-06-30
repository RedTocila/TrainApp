import { requireAdmin } from "@/lib/actions/auth";
import { WorkoutBuilder } from "@/components/workout-builder";
import { PageTransition } from "@/components/page-transition";

export default async function NewWorkoutPage() {
  await requireAdmin();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Create Workout Plan</h1>
          <p className="text-muted-foreground">Template plan for your library</p>
        </div>
        <WorkoutBuilder />
      </div>
    </PageTransition>
  );
}
