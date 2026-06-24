import { createClient } from "@/lib/supabase/server";
import { hasAiAccess } from "@/lib/subscription";
import { AiUpgradeGate } from "@/components/ai-upgrade-gate";
import { AiWorkoutPlanBuilder } from "@/components/ai-workout-plan-builder";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";
import type { Profile } from "@/lib/types";

export default async function AiWorkoutPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return null;
  if (!hasAiAccess(profile)) return <AiUpgradeGate />;

  return (
    <AiWorkoutPlanBuilder
      profile={profile as Profile}
      intakeComplete={isClientIntakeComplete(profile as Profile)}
    />
  );
}
