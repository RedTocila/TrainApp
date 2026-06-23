import { notFound, redirect } from "next/navigation";
import { requireClient } from "@/lib/actions/auth";
import {
  getExerciseHistories,
  getWorkoutSession,
} from "@/lib/actions/workout-sessions";
import { ActiveWorkoutClient } from "@/components/active-workout-client";
import { PageTransition } from "@/components/page-transition";

export default async function WorkoutSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireClient();
  const { id } = await params;
  const data = await getWorkoutSession(id);

  if (!data) notFound();

  const { session, exercises } = data;

  if (session.status === "completed") {
    redirect("/dashboard/workout");
  }

  if (session.status === "cancelled") {
    notFound();
  }

  const histories = await getExerciseHistories(
    exercises.map((ex) => ({
      exerciseId: ex.exercise_id,
      name: ex.name,
    }))
  );

  return (
    <PageTransition>
      <ActiveWorkoutClient
        session={session}
        exercises={exercises}
        histories={histories}
      />
    </PageTransition>
  );
}
