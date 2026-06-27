import { requireClient } from "@/lib/actions/auth";
import { getClientCardioList } from "@/lib/actions/user-cardio";
import { CardioListPage } from "@/components/cardio-list-page";
import { WorkoutPageHeader } from "@/components/workout-page-header";
import { PageTransition } from "@/components/page-transition";

export default async function WorkoutCardioPage() {
  await requireClient();
  const cardio = await getClientCardioList();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-4">
        <WorkoutPageHeader title="Cardio" />
        <CardioListPage initialCardio={cardio} />
      </div>
    </PageTransition>
  );
}
