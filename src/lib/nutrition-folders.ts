export const UNCATEGORIZED_NUTRITION_FOLDER_ID = "uncategorized";

export function resolveNutritionFolderId(folderId: string | null | undefined): string {
  return folderId ?? UNCATEGORIZED_NUTRITION_FOLDER_ID;
}
