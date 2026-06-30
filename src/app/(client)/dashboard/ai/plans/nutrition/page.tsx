import { createClient } from "@/lib/supabase/server";
import { hasAiPlanBuilderAccess } from "@/lib/subscription-limits";
import { AiUpgradeGate } from "@/components/ai-upgrade-gate";
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
  if (!hasAiPlanBuilderAccess(profile)) return <AiUpgradeGate />;

  return (
    <AiNutritionPlanBuilder
      profile={profile as Profile}
      intakeComplete={isClientIntakeComplete(profile as Profile)}
    />
  );
}
