"use server";

import { createClient } from "@/lib/supabase/server";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found" };
  const typedProfile = profile as Profile;

  if (!hasPaidAccess(typedProfile)) {
    return { error: SUBSCRIPTION_REQUIRED_MESSAGE };
  }

  return { supabase, userId: user.id, profile: typedProfile };
}

export async function requireSubscribedUserId() {
  const access = await requireSubscribedUserAccess();
  if ("error" in access) {
    throw new Error(access.error);
  }
  return access;
}
