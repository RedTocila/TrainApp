import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import { getPersonalNutritionPlans } from "@/lib/actions/user-nutrition";
import { NutritionSectionTabs } from "@/components/nutrition-section-tabs";
import { RecipeTemplatesPage } from "@/components/recipe-templates-page";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";

export default async function NutritionTemplatesPage() {
  await requireClient();
  const plans = await getPersonalNutritionPlans();

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-0">
        <NutritionSectionTabs />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/nutrition/meals">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-black">Recipe book</h1>
                <p className="text-xs text-muted-foreground">13k+ recipes from Epicurious dataset</p>
              </div>
            </div>
          </div>
        </div>

        <RecipeTemplatesPage plans={plans} />
      </div>
    </PageTransition>
  );
}

