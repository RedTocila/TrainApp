import { requireClient } from "@/lib/actions/auth";
import { NewWorkoutClient } from "@/components/new-workout-client";
import { PageTransition } from "@/components/page-transition";

export default async function NewWorkoutPage() {
  await requireClient();

  return (
    <PageTransition>
      <NewWorkoutClient />
    </PageTransition>
  );
}
