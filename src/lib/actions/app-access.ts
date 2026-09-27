"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { grantAppFreeAccess } from "@/lib/app-free-access-grant";

/** Called from the native shell: unlock everything for the signed-in user. */
export async function ensureAppFreeAccess(): Promise<{ granted: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { granted: false };

  const granted = await grantAppFreeAccess(user.id);
  if (granted) revalidatePath("/", "layout");
  return { granted };
}
