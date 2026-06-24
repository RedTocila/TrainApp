"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";
import { formatGoal } from "@/lib/intake-display";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";
import {
  responsesToProfileFields,
  type IntakeResponses,
} from "@/lib/intake-questionnaire";
import { resolveMacroTargets } from "@/lib/resolve-macro-targets";

export interface ClientIntakeInfo {
  profile: Profile;
  latestWeightKg: number | null;
  goalLabel: string | null;
}

export async function getClientIntakeInfo(clientId: string): Promise<ClientIntakeInfo | null> {
  await requireAdmin();

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", clientId)
    .single();

  if (!profile) return null;

  const { data: weightLogs } = await admin
    .from("body_weight_logs")
    .select("weight_kg, date")
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .limit(1);

  const latestLog = weightLogs?.[0];
  const latestWeightKg =
    latestLog?.weight_kg != null
      ? Number(latestLog.weight_kg)
      : profile.intake_weight_kg
        ? Number(profile.intake_weight_kg)
        : null;

  return {
    profile: profile as Profile,
    latestWeightKg,
    goalLabel: profile.goal ? formatGoal(profile.goal) : null,
  };
}

export async function updateClientIntakeFromResponses(responses: IntakeResponses) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const intakeFields = responsesToProfileFields(responses);

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const mergedProfile = {
    ...(existingProfile as Profile),
    ...intakeFields,
  };

  const resolved = await resolveMacroTargets(mergedProfile, responses);
  const shouldUpdateMacros =
    isClientIntakeComplete(mergedProfile) && resolved !== null;

  const profileUpdate: Record<string, unknown> = { ...intakeFields };

  if (shouldUpdateMacros && resolved) {
    profileUpdate.target_calories = resolved.targets.calories;
    profileUpdate.target_protein = resolved.targets.protein;
    profileUpdate.target_carbs = resolved.targets.carbs;
    profileUpdate.target_fat = resolved.targets.fat;
  }

  const { error } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/nutrition");
  revalidatePath("/dashboard");

  return {
    success: true,
    intakeComplete: isClientIntakeComplete(mergedProfile),
    macrosUpdated: shouldUpdateMacros,
    macros: shouldUpdateMacros ? resolved?.targets : undefined,
    macroSource: resolved?.source,
    macroRationale: resolved?.rationale,
  };
}

/** @deprecated Use updateClientIntakeFromResponses */
export async function updateClientIntake(formData: FormData) {
  const raw = formData.get("intake_json") as string | null;
  if (raw) {
    try {
      return updateClientIntakeFromResponses(JSON.parse(raw) as IntakeResponses);
    } catch {
      return { error: "Invalid intake data" };
    }
  }
  return { error: "Use the health questionnaire to save your profile" };
}

export async function applyIntakeToProfile(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  responses: IntakeResponses
) {
  const intakeFields = responsesToProfileFields(responses);
  const mergedProfile = intakeFields as Profile;
  const resolved = await resolveMacroTargets(mergedProfile, responses);

  const profileUpdate: Record<string, unknown> = { ...intakeFields };
  if (resolved) {
    profileUpdate.target_calories = resolved.targets.calories;
    profileUpdate.target_protein = resolved.targets.protein;
    profileUpdate.target_carbs = resolved.targets.carbs;
    profileUpdate.target_fat = resolved.targets.fat;
  }

  await supabase.from("profiles").update(profileUpdate).eq("id", userId);
}

export async function dismissHabitSuggestion(suggestionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("dismissed_habit_suggestions")
    .eq("id", user.id)
    .single();

  const current = (profile?.dismissed_habit_suggestions as string[] | null) ?? [];
  if (current.includes(suggestionId)) {
    return { success: true };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      dismissed_habit_suggestions: [...current, suggestionId],
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function applyHabitSuggestion(suggestionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found" };

  const { addSuggestedHabit } = await import("@/lib/actions/habits");
  const result = await addSuggestedHabit(user.id, suggestionId, profile as Profile);

  if ("error" in result && result.error) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
