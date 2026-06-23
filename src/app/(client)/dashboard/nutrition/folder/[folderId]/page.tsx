import { notFound } from "next/navigation";
import { requireClient } from "@/lib/actions/auth";
import {
  getNutritionFolderMeta,
  getNutritionFoldersForMove,
  getNutritionPlansAvailableForFolder,
  getPersonalNutritionPlansInFolder,
} from "@/lib/actions/user-nutrition";
import { getScheduledNutritionDatesByPlan } from "@/lib/actions/user-nutrition-schedule";
import { FolderMealsPage } from "@/components/folder-meals-page";
import { PageTransition } from "@/components/page-transition";

export default async function FolderNutritionRoute({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  await requireClient();
  const { folderId } = await params;
  const folder = await getNutritionFolderMeta(folderId);

  if (!folder) notFound();

  const [plans, folders, availablePlans, scheduledDatesByPlan] = await Promise.all([
    getPersonalNutritionPlansInFolder(folderId),
    getNutritionFoldersForMove(),
    getNutritionPlansAvailableForFolder(folderId),
    getScheduledNutritionDatesByPlan(),
  ]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl">
        <FolderMealsPage
          folderId={folderId}
          folderName={folder.name}
          plans={plans}
          folders={folders}
          availablePlans={availablePlans}
          scheduledDatesByPlan={scheduledDatesByPlan}
        />
      </div>
    </PageTransition>
  );
}
