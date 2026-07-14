import { notFound, redirect } from "next/navigation";
import { requireClient } from "@/lib/actions/auth";
import { getWorkoutSession } from "@/lib/actions/workout-sessions";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { ActiveWorkoutClient } from "@/components/active-workout-client";
import { ActiveHiitClient } from "@/components/active-hiit-client";
import { PageTransition } from "@/components/page-transition";

export default async function WorkoutSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireClient();
  const { id } = await params;
  const [data, profile] = await Promise.all([
    getWorkoutSession(id),
    getSubscriptionProfile(),
  ]);

  if (!data) notFound();

  const { session, exercises, planKind, hiitConfig } = data;

  if (session.status === "completed") {
    redirect("/dashboard/workout");
  }

  if (session.status === "cancelled") {
    notFound();
  }

  if (planKind === "hiit") {
    if (!hiitConfig) notFound();
    return (
      <PageTransition>
        <ActiveHiitClient session={session} config={hiitConfig} />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <ActiveWorkoutClient
        session={session}
        exercises={exercises}
        gender={profile?.gender}
      />
    </PageTransition>
  );
}
