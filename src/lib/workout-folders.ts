export const UNCATEGORIZED_FOLDER_ID = "uncategorized";

export function resolveWorkoutFolderId(folderId: string | null | undefined): string {
  return folderId ?? UNCATEGORIZED_FOLDER_ID;
}
