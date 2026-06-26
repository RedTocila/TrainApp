import { requireClient } from "@/lib/actions/auth";
import { getClientCardioList } from "@/lib/actions/user-cardio";
import { CardioListPage } from "@/components/cardio-list-page";
import { WorkoutSectionTabs } from "@/components/workout-section-tabs";
import { PageTransition } from "@/components/page-transition";

export default async function WorkoutCardioPage() {
  await requireClient();
  const cardio = await getClientCardioList();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-black">Cardio</h1>
          <WorkoutSectionTabs />
        </div>
        <CardioListPage initialCardio={cardio} />
      </div>
    </PageTransition>
  );
}
