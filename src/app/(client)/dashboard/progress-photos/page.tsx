import { requireClient } from "@/lib/actions/auth";
import { getProgressPhotoSets } from "@/lib/actions/progress-photos";
import { ProgressPhotosHistoryPage } from "@/components/progress-photos-history-page";
import { PageTransition } from "@/components/page-transition";

export default async function ProgressPhotosPage() {
  const profile = await requireClient();
  const sets = await getProgressPhotoSets(profile.id);

  return (
    <PageTransition>
      <ProgressPhotosHistoryPage clientId={profile.id} initialSets={sets} />
    </PageTransition>
  );
}
