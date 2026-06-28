import { requireClient } from "@/lib/actions/auth";
import { ProgressPhotosHistoryPage } from "@/components/progress-photos-history-page";

export default async function ProgressPhotosPage() {
  const profile = await requireClient();

  return <ProgressPhotosHistoryPage clientId={profile.id} />;
}
