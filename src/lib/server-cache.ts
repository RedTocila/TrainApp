import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_COLUMNS } from "@/lib/db-selects";
import type { Profile } from "@/lib/types";

async function fetchProfileById(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .single();
  return (data as Profile | null) ?? null;
}

/** Short-lived profile cache for read-heavy server paths (30s). */
export function getCachedProfile(userId: string) {
  return unstable_cache(
    () => fetchProfileById(userId),
    ["profile", userId],
    { revalidate: 30, tags: [`profile:${userId}`] }
  )();
}
