"use server";

import { revalidatePath } from "next/cache";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { PLATFORM_AI_NAME } from "@/lib/brand";
import { analyzeProgressPhoto } from "@/lib/ai/analyze-progress-photo";
import {
  getProgressPhotoSetsWithAnalysis,
  priorProgressNotesForPose,
} from "@/lib/ai/progress-photo-context";
import { isAiConfigured } from "@/lib/ai/providers";
import { getProgressPhotoSetForMonth, saveProgressPhotoAnalysis } from "@/lib/actions/progress-photos";
import { hasAiAccess } from "@/lib/subscription";
import type { ProgressPhotoAnalysis, ProgressPhotoPose } from "@/lib/types";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type AnalyzeProgressPhotoResult =
  | { skipped: true; reason: "no_ai" | "not_configured" }
  | { analysis: ProgressPhotoAnalysis }
  | { error: string };

async function requireProgressPhotoAiAccess(): Promise<
  | {
      success: true;
      profile: NonNullable<Awaited<ReturnType<typeof getSubscriptionProfile>>>;
    }
  | { success: false; error: string; skipped: true }
> {
  const profile = await getSubscriptionProfile();
  if (!profile) return { success: false, error: "Not authenticated", skipped: true };
  if (!hasAiAccess(profile)) {
    return {
      success: false,
      error: `Upgrade to ${PLATFORM_AI_NAME} for Coach Alex progress photo analysis.`,
      skipped: true,
    };
  }
  if (!isAiConfigured()) {
    return {
      success: false,
      error: "AI is not configured on the server.",
      skipped: true,
    };
  }
  return { success: true, profile };
}

export async function analyzeProgressPhotoAction(input: {
  pose: ProgressPhotoPose;
  imageBase64: string;
  mimeType: string;
  monthKey?: string;
  locale?: string | null;
}): Promise<AnalyzeProgressPhotoResult> {
  const access = await requireProgressPhotoAiAccess();
  if (!access.success) {
    if (access.skipped) return { skipped: true, reason: "no_ai" };
    return { error: access.error };
  }

  const { pose, imageBase64, mimeType, monthKey, locale } = input;
  if (!imageBase64.trim()) return { error: "No photo provided" };
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { error: "Unsupported image type. Use JPEG, PNG, or WebP." };
  }

  const sizeBytes = Math.ceil((imageBase64.length * 3) / 4);
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return { error: "Image is too large. Please use a photo under 2 MB." };
  }

  let priorProgressNotes: string | null = null;
  if (monthKey) {
    const sets = await getProgressPhotoSetsWithAnalysis(access.profile.id, 12);
    priorProgressNotes = priorProgressNotesForPose(sets, pose, monthKey);
  }

  try {
    const analysis = await analyzeProgressPhoto(pose, imageBase64, mimeType, {
      userGoal: access.profile.goal,
      locale: locale ?? access.profile.preferred_locale,
      priorProgressNotes,
    });
    return { analysis };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze progress photo";
    return { error: message };
  }
}

export async function analyzeAndSaveProgressPhotoAction(input: {
  clientId: string;
  monthKey: string;
  pose: ProgressPhotoPose;
  imageBase64: string;
  mimeType: string;
  locale?: string | null;
}): Promise<
  | { skipped: true }
  | { analysis: ProgressPhotoAnalysis; saved: boolean }
  | { error: string }
> {
  const result = await analyzeProgressPhotoAction({
    pose: input.pose,
    imageBase64: input.imageBase64,
    mimeType: input.mimeType,
    monthKey: input.monthKey,
    locale: input.locale,
  });

  if ("skipped" in result) return { skipped: true };
  if ("error" in result) return { error: result.error };

  const set = await getProgressPhotoSetForMonth(input.clientId, input.monthKey);
  if (!set) return { analysis: result.analysis, saved: false };

  const saveResult = await saveProgressPhotoAnalysis(
    input.clientId,
    input.monthKey,
    input.pose,
    result.analysis
  );
  if (saveResult.error) return { error: saveResult.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/progress-photos");
  return { analysis: result.analysis, saved: true };
}
