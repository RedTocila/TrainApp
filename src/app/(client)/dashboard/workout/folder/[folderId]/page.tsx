import { notFound } from "next/navigation";
import { requireClient } from "@/lib/actions/auth";
import {
  getPersonalWorkoutsWithSchedules,
  getWorkoutFolderMeta,
  getWorkoutFoldersForMove,
  getWorkoutsAvailableForFolder,
} from "@/lib/actions/user-workouts";
import { FolderWorkoutsPage } from "@/components/folder-workouts-page";
import { PageTransition } from "@/components/page-transition";

export default async function FolderWorkoutsRoute({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  await requireClient();
  const { folderId } = await params;
  const folder = await getWorkoutFolderMeta(folderId);

  if (!folder) notFound();

  const [workouts, folders, availableWorkouts] = await Promise.all([
    getPersonalWorkoutsWithSchedules(folderId),
    getWorkoutFoldersForMove(),
    getWorkoutsAvailableForFolder(folderId),
  ]);

  return (
    <PageTransition>
      <FolderWorkoutsPage
        folderId={folderId}
        folderName={folder.name}
        workouts={workouts}
        folders={folders}
        availableWorkouts={availableWorkouts}
      />
    </PageTransition>
  );
}
