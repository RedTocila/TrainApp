import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import {
  getNutritionFoldersForMove,
  getPersonalMealsLibrary,
} from "@/lib/actions/user-nutrition";
import { MyMealsPage } from "@/components/my-meals-page";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";

export default async function MyMealsRoute() {
  await requireClient();

  const [meals, folders] = await Promise.all([
    getPersonalMealsLibrary(),
    getNutritionFoldersForMove(),
  ]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col gap-3">
          <Link href="/dashboard/nutrition">
            <Button variant="ghost" size="sm" className="-ml-2 w-fit">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to folders
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black">My Meals</h1>
            <p className="text-sm text-muted-foreground">
              All meals from your plans — filter, edit, or add to another folder
            </p>
          </div>
        </div>

        <MyMealsPage initialMeals={meals} folders={folders} />
      </div>
    </PageTransition>
  );
}
