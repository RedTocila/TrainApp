"use server";

import { createClient } from "@/lib/supabase/server";
import { SUBSCRIPTION_ACCESS_COLUMNS } from "@/lib/db-selects";
import { hasPaidAccess } from "@/lib/subscription";
import { SUBSCRIPTION_REQUIRED_MESSAGE } from "@/lib/subscription-messages";
import type { Profile } from "@/lib/types";

export async function requireSubscribedUserAccess(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; profile: Profile }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: accessProfile } = await supabase
    .from("profiles")
    .select(SUBSCRIPTION_ACCESS_COLUMNS)
    .eq("id", user.id)
    .single();

  if (!accessProfile) return { error: "Profile not found" };

  if (!hasPaidAccess(accessProfile as Profile)) {
    return { error: SUBSCRIPTION_REQUIRED_MESSAGE };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found" };
  const typedProfile = profile as Profile;

  return { supabase, userId: user.id, profile: typedProfile };
}

export async function requireSubscribedUserId() {
  const access = await requireSubscribedUserAccess();
  if ("error" in access) {
    throw new Error(access.error);
  }
  return access;
}
