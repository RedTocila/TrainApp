import { requireClient } from "@/lib/actions/auth";
import { MealPhotosPage } from "@/components/meal-photos-page";

export default async function MealPhotosRoute() {
  const profile = await requireClient();

  const targets = {
    calories: profile.target_calories ?? 2000,
    protein: profile.target_protein ?? 150,
    carbs: profile.target_carbs ?? 200,
    fat: profile.target_fat ?? 65,
  };

  return (
    <MealPhotosPage
      clientId={profile.id}
      targets={targets}
      goal={profile.goal ?? null}
    />
  );
}
