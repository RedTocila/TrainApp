import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import { getPersonalExercisesLibrary } from "@/lib/actions/user-workouts";
import { MyExercisesPage } from "@/components/my-exercises-page";
import { WorkoutSectionTabs } from "@/components/workout-section-tabs";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";

export default async function WorkoutExercisesPage() {
  await requireClient();
  const exercises = await getPersonalExercisesLibrary();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <WorkoutSectionTabs />
        <div className="flex flex-col gap-3">
          <Link href="/dashboard/workout">
            <Button variant="ghost" size="sm" className="-ml-2 w-fit">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to workouts
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black">My Exercises</h1>
            <p className="text-sm text-muted-foreground">
              Browse 800+ exercises or see what you&apos;ve added to workouts
            </p>
          </div>
        </div>

        <MyExercisesPage initialExercises={exercises} />
      </div>
    </PageTransition>
  );
}
