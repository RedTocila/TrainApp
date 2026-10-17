"use server";

import { createClient } from "@/lib/supabase/server";
import { pushPlatformsConfigured, type PushPlatform } from "@/lib/push-delivery";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getPushDeliveryReady(): Promise<{
  ios: boolean;
  android: boolean;
}> {
  return pushPlatformsConfigured();
}

export async function registerPushDevice(
  token: string,
  platform: PushPlatform
): Promise<{ success?: true; error?: string }> {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length > 4096) return { error: "Invalid token" };
  if (platform !== "ios" && platform !== "android") return { error: "Invalid platform" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin.from("push_devices").upsert(
    {
      user_id: user.id,
      token: trimmed,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" }
  );
  if (error) return { error: error.message };
  return { success: true };
}
