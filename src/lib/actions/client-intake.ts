"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";

export interface ClientIntakeInfo {
  profile: Profile;
  latestWeightKg: number | null;
  goalLabel: string | null;
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "Lose weight",
  build_muscle: "Build muscle",
  stay_fit: "Stay fit",
  improve_endurance: "Improve endurance",
  general_health: "General health",
};

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
    goalLabel: profile.goal ? GOAL_LABELS[profile.goal] ?? profile.goal : null,
  };
}

export async function updateClientIntake(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parseOptionalNumber = (key: string) => {
    const raw = (formData.get(key) as string)?.trim();
    if (!raw) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  };

  const textOrNull = (key: string) => {
    const v = (formData.get(key) as string)?.trim();
    return v || null;
  };

  const goal = textOrNull("goal");

  const { error } = await supabase
    .from("profiles")
    .update({
      height_cm: parseOptionalNumber("height_cm"),
      intake_weight_kg: parseOptionalNumber("intake_weight_kg"),
      vices: textOrNull("vices"),
      injuries: textOrNull("injuries"),
      medical_conditions: textOrNull("medical_conditions"),
      daily_routine: textOrNull("daily_routine"),
      work_schedule: textOrNull("work_schedule"),
      goal,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/nutrition");
  return { success: true };
}
