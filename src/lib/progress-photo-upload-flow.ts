import { compressImageFile, fileToDataUrl, parseDataUrl } from "@/lib/image-compress";
import { analyzeProgressPhotoAction } from "@/lib/actions/progress-photo-ai";
import {
  saveProgressPhotoAnalysis,
  saveProgressPhotoPath,
} from "@/lib/actions/progress-photos";
import { progressMonthFolder } from "@/lib/progress-photo-utils";
import { progressPhotoPath, STORAGE_BUCKETS, type ProgressPhotoPose } from "@/lib/supabase/storage";
import type { ProgressPhotoAnalysis } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProgressPhotoUploadResult =
  | { status: "rejected"; analysis: ProgressPhotoAnalysis }
  | { status: "success"; path: string; analysis: ProgressPhotoAnalysis | null }
  | { status: "error"; message: string };

export async function uploadProgressPhotoWithAiReview(input: {
  supabase: SupabaseClient;
  clientId: string;
  monthKey: string;
  pose: ProgressPhotoPose;
  file: File;
  locale?: string | null;
}): Promise<ProgressPhotoUploadResult> {
  const { supabase, clientId, monthKey, pose, file, locale } = input;

  let compressed: File;
  try {
    compressed = await compressImageFile(file);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not process image",
    };
  }

  const dataUrl = await fileToDataUrl(compressed);
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    return { status: "error", message: "Could not read photo" };
  }

  let analysis: ProgressPhotoAnalysis | null = null;

  const aiResult = await analyzeProgressPhotoAction({
    pose,
    imageBase64: parsed.base64,
    mimeType: parsed.mimeType,
    monthKey,
    locale,
  });

  if ("analysis" in aiResult) {
    analysis = aiResult.analysis;
    if (!analysis.valid) {
      return { status: "rejected", analysis };
    }
  } else if ("error" in aiResult) {
    return { status: "error", message: aiResult.error };
  }

  const monthFolder = progressMonthFolder(monthKey);
  const extension = compressed.type === "image/webp" ? "webp" : "jpg";
  const path = progressPhotoPath(clientId, monthFolder, pose, extension);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.progressPhotos)
    .upload(path, compressed, {
      upsert: true,
      cacheControl: "31536000",
      contentType: compressed.type,
    });

  if (uploadError) {
    return { status: "error", message: uploadError.message };
  }

  const saveResult = await saveProgressPhotoPath(clientId, monthKey, pose, path);
  if (saveResult.error) {
    return { status: "error", message: saveResult.error };
  }

  if (analysis) {
    const analysisSave = await saveProgressPhotoAnalysis(
      clientId,
      monthKey,
      pose,
      analysis
    );
    if (analysisSave.error) {
      return { status: "error", message: analysisSave.error };
    }
  }

  return { status: "success", path, analysis };
}
