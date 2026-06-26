import { requireClient } from "@/lib/actions/auth";
import { getPersonalExercisesLibrary } from "@/lib/actions/user-workouts";
import { MyExercisesPage } from "@/components/my-exercises-page";
import { WorkoutSectionTabs } from "@/components/workout-section-tabs";
import { PageTransition } from "@/components/page-transition";

export default async function WorkoutExercisesPage() {
  await requireClient();
  const exercises = await getPersonalExercisesLibrary();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-black">Exercises</h1>
          <WorkoutSectionTabs />
        </div>
        <MyExercisesPage initialExercises={exercises} />
      </div>
    </PageTransition>
  );
}
