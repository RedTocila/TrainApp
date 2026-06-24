"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionProfile } from "@/lib/actions/subscriptions";
import { hasAiAccess } from "@/lib/subscription";
import { isAiConfigured } from "@/lib/ai/providers";
import {
  analyzeMealPhoto,
  mealAnalysisToForm,
} from "@/lib/ai/meal-photo";
import { analyzeMealText } from "@/lib/ai/meal-text";
import type { MealAnalysisResult } from "@/lib/ai/types";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

async function requireAiMealAccess(): Promise<
  { success: true; profile: NonNullable<Awaited<ReturnType<typeof getSubscriptionProfile>>> } |
  { success: false; error: string }
> {
  const profile = await getSubscriptionProfile();
  if (!profile) return { success: false, error: "Not authenticated" };
  if (!hasAiAccess(profile)) {
    return { success: false, error: "Upgrade to TrainApp AI to use AI meal logging." };
  }
  if (!isAiConfigured()) {
    return { success: false, error: "AI meal analysis is not configured on the server yet." };
  }
  return { success: true, profile };
}

async function storeMealAnalysis(
  userId: string,
  source: "photo" | "text",
  result: MealAnalysisResult,
  inputText?: string
) {
  const supabase = await createClient();
  await supabase.from("ai_meal_analyses").insert({
    user_id: userId,
    source,
    input_text: inputText ?? null,
    result,
    confidence: result.confidence,
  });
}

export async function analyzeMealPhotoAction(
  imageBase64: string,
  mimeType: string
): Promise<{ result: MealAnalysisResult; form: ReturnType<typeof mealAnalysisToForm> } | { error: string }> {
  const access = await requireAiMealAccess();
  if (!access.success) return { error: access.error };

  if (!imageBase64.trim()) return { error: "No photo provided" };
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { error: "Unsupported image type. Use JPEG, PNG, or WebP." };
  }

  const sizeBytes = Math.ceil((imageBase64.length * 3) / 4);
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return { error: "Image is too large. Please use a photo under 2 MB." };
  }

  try {
    const result = await analyzeMealPhoto(imageBase64, mimeType);
    await storeMealAnalysis(access.profile.id, "photo", result);
    return { result, form: mealAnalysisToForm(result) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze meal photo";
    return { error: message };
  }
}

export async function analyzeMealTextAction(
  text: string
): Promise<{ result: MealAnalysisResult; form: ReturnType<typeof mealAnalysisToForm> } | { error: string }> {
  const access = await requireAiMealAccess();
  if (!access.success) return { error: access.error };

  try {
    const result = await analyzeMealText(text);
    await storeMealAnalysis(access.profile.id, "text", result, text);
    return { result, form: mealAnalysisToForm(result) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to parse meal description";
    return { error: message };
  }
}

export async function linkMealAnalysisToLog(analysisId: string, mealLogId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("ai_meal_analyses")
    .update({ logged_meal_id: mealLogId })
    .eq("id", analysisId)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/ai");
}
