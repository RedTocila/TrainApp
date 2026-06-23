import { requireAdmin } from "@/lib/actions/auth";
import { WorkoutBuilder } from "@/components/workout-builder";
import { PageTransition } from "@/components/page-transition";

export default async function NewWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; request?: string }>;
}) {
  await requireAdmin();
  const { client, request } = await searchParams;

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Create Workout Plan</h1>
          {client && (
            <p className="text-muted-foreground">Building for client assignment</p>
          )}
        </div>
        <WorkoutBuilder clientId={client} requestId={request} />
      </div>
    </PageTransition>
  );
}
