"use server";

import { createClient } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/cached-profile";
import { readMeFromSettings, withReadMeAck } from "@/lib/read-me-acks";

export type ReadMeAcknowledgments = {
  coach: boolean;
  progressPhotos: boolean;
};

export async function getReadMeAcknowledgments(): Promise<ReadMeAcknowledgments> {
  const profile = await getCachedProfile();
  const acks = readMeFromSettings(profile?.reminder_settings);
  return {
    coach: acks.coach === true,
    progressPhotos: acks.progressPhotos === true,
  };
}

async function patchReadMeAck(
  patch: Parameters<typeof withReadMeAck>[1]
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const profile = await getCachedProfile();
  const next = withReadMeAck(profile?.reminder_settings, patch);

  const { error } = await supabase
    .from("profiles")
    .update({ reminder_settings: next })
    .eq("id", user.id);

  if (error) {
    if (error.message?.includes("reminder_settings")) {
      return {
        error:
          "Could not save Read me. Apply the latest database migration for reminder settings.",
      };
    }
    return { error: error.message };
  }

  return { success: true };
}

export async function acknowledgeCoachReadMe(): Promise<
  { success: true } | { error: string }
> {
  return patchReadMeAck({
    coach: true,
    coachAt: new Date().toISOString(),
  });
}

export async function acknowledgeProgressPhotoReadMe(): Promise<
  { success: true } | { error: string }
> {
  return patchReadMeAck({
    progressPhotos: true,
    progressPhotosAt: new Date().toISOString(),
  });
}
