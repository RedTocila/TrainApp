import { createClient } from "@/lib/supabase/server";
import { hasAiPlanBuilderAccess } from "@/lib/subscription-limits";
import { buildPricingHref } from "@/lib/pricing-nav";
import { redirect } from "next/navigation";
import { AiNutritionPlanBuilder } from "@/components/ai-nutrition-plan-builder";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";
import type { Profile } from "@/lib/types";

export default async function AiNutritionPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return null;
  if (!hasAiPlanBuilderAccess(profile)) {
    redirect(buildPricingHref("/dashboard/ai/plans/nutrition"));
  }

  return (
    <AiNutritionPlanBuilder
      profile={profile as Profile}
      intakeComplete={isClientIntakeComplete(profile as Profile)}
    />
  );
}
