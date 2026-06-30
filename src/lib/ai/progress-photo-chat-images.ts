import { analyzeProgressPhoto } from "@/lib/ai/analyze-progress-photo";
import {
  getProgressPhotoSetsWithAnalysis,
  priorProgressNotesForPose,
} from "@/lib/ai/progress-photo-context";
import { isAiConfigured } from "@/lib/ai/providers";
import type { ChatImageAttachment } from "@/lib/ai/types";
import { progressSetHasPhotos } from "@/lib/progress-photo-utils";
import {
  buildProgressPhotoIdentityFromAnalysis,
  profileHasProgressPhotoIdentity,
} from "@/lib/progress-photo-identity";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Profile,
  ProgressPhotoAnalysis,
  ProgressPhotoPose,
  ProgressPhotoSet,
} from "@/lib/types";

const MAX_CHAT_IMAGES = 6;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const ANALYSIS_COLUMNS: Record<
  ProgressPhotoPose,
  keyof Pick<ProgressPhotoSet, "front_analysis" | "back_analysis" | "side_analysis">
> = {
  front: "front_analysis",
  back: "back_analysis",
  side: "side_analysis",
};

const PATH_COLUMNS: Record<
  ProgressPhotoPose,
  keyof Pick<ProgressPhotoSet, "front_path" | "back_path" | "side_path">
> = {
  front: "front_path",
  back: "back_path",
  side: "side_path",
};

export type ProgressPhotoChatAttachment = ChatImageAttachment & {
  label: string;
  monthKey: string;
  pose: ProgressPhotoPose;
};

function mimeTypeFromPath(path: string): string {
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/** True when the user wants visual physique / progress-photo feedback (not general coaching). */
export function shouldAttachProgressPhotosToChat(
  message: string,
  hasUserAttachedImage: boolean
): boolean {
  if (hasUserAttachedImage) return false;

  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;

  const explicitPhotoAsk =
    /\b(progress\s*photos?|check-?in\s*photos?|monthly\s*photos?|my\s*photos?|foto\s*(e\s*)?progres|fotot\s+e\s+progres)\b/i.test(
      normalized
    ) ||
    /\b(analyz|review|compare|rate|check)\w*\b.{0,40}\b(photo|photos|physique|progress|body|pamje|foto|trup)\b/i.test(
      normalized
    ) ||
    /\b(photo|photos|foto|pamje)\b.{0,40}\b(progress|physique|body|progres|trup|check-?in|month)\b/i.test(
      normalized
    );

  const physiqueVisualAsk =
    /\bhow\s+(am\s+i|do\s+i)\s+look(ing)?\b/i.test(normalized) ||
    /\bhow\s+is\s+my\s+(body|physique|progress)\b/i.test(normalized) ||
    /\b(physique|visual)\s+progress\b/i.test(normalized) ||
    /\bbody\s+(fat|composition|shape|recomp)\b/i.test(normalized) ||
    /\bwhat\s+(muscle|muscles).*\b(missing|lag|behind|weak|under)\b/i.test(normalized) ||
    /\bmuscle\s+groups?\s+to\s+(focus|priorit|work|train)\b/i.test(normalized) ||
    /\bwhat\s+should\s+i\s+focus\s+on\b.*\b(physique|body|muscle|look)\b/i.test(normalized) ||
    /\b(transform(ation)?|recomp)\b.*\b(photo|physique|body|progress)\b/i.test(normalized) ||
    /\b(si\s+dukem|trupi\s+im|progresi\s+im|foto\s+progres|muskujt\s+që\s+mungojnë)\b/i.test(
      normalized
    );

  const posePhotoAsk =
    /\b(front|back|side)\s+(photo|pose|pic|view|shot)\b/i.test(normalized) ||
    /\b(photo|foto|pamje)\b.*\b(front|back|side|para|prapa|anash)\b/i.test(normalized) ||
    /\b(para|prapa|anash)\s+(foto|pamje)\b/i.test(normalized);

  return explicitPhotoAsk || physiqueVisualAsk || posePhotoAsk;
}

function posesForMessage(message: string): ProgressPhotoPose[] | null {
  const normalized = message.toLowerCase();
  const wantsFront = /\bfront|para|perpara|përpara\b/i.test(normalized);
  const wantsBack = /\bback|prapa\b/i.test(normalized);
  const wantsSide = /\bside|anash|profil\b/i.test(normalized);

  if (wantsFront && !wantsBack && !wantsSide) return ["front"];
  if (wantsBack && !wantsFront && !wantsSide) return ["back"];
  if (wantsSide && !wantsFront && !wantsBack) return ["side"];
  if (wantsFront || wantsBack || wantsSide) {
    return (["front", "back", "side"] as ProgressPhotoPose[]).filter(
      (pose) =>
        (pose === "front" && wantsFront) ||
        (pose === "back" && wantsBack) ||
        (pose === "side" && wantsSide)
    );
  }
  return null;
}

type PhotoCandidate = {
  monthKey: string;
  pose: ProgressPhotoPose;
  path: string;
};

function collectPhotoCandidates(
  sets: ProgressPhotoSet[],
  message: string
): PhotoCandidate[] {
  const poseFilter = posesForMessage(message);
  const candidates: PhotoCandidate[] = [];

  const sorted = [...sets].sort((a, b) => b.month_key.localeCompare(a.month_key));

  for (const set of sorted) {
    for (const pose of ["front", "back", "side"] as ProgressPhotoPose[]) {
      if (poseFilter && !poseFilter.includes(pose)) continue;
      const path = set[PATH_COLUMNS[pose]];
      if (!path) continue;
      candidates.push({
        monthKey: set.month_key,
        pose,
        path,
      });
    }
  }

  if (poseFilter?.length === 1 && poseFilter[0] === "front") {
    return candidates
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .slice(-MAX_CHAT_IMAGES);
  }

  return candidates.slice(0, MAX_CHAT_IMAGES);
}

async function downloadPhotoBase64(
  admin: SupabaseClient,
  path: string
): Promise<ChatImageAttachment | null> {
  const { data, error } = await admin.storage.from(STORAGE_BUCKETS.progressPhotos).download(path);
  if (error || !data) return null;

  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) return null;

  return {
    mimeType: mimeTypeFromPath(path),
    base64: buffer.toString("base64"),
  };
}

async function saveAnalysisOnSet(
  admin: SupabaseClient,
  setId: string,
  pose: ProgressPhotoPose,
  analysis: ProgressPhotoAnalysis
) {
  await admin
    .from("progress_photo_sets")
    .update({
      [ANALYSIS_COLUMNS[pose]]: analysis,
      updated_at: new Date().toISOString(),
    })
    .eq("id", setId);
}

/** Analyze stored photos that have a file but no saved analysis yet. */
export async function backfillMissingProgressPhotoAnalyses(
  admin: SupabaseClient,
  profile: Profile,
  sets: ProgressPhotoSet[]
): Promise<ProgressPhotoSet[]> {
  if (!isAiConfigured()) return sets;

  const updated = structuredClone(sets) as ProgressPhotoSet[];
  let identityBaseline = profile.progress_photo_identity ?? null;

  for (const set of updated) {
    if (!progressSetHasPhotos(set)) continue;

    for (const pose of ["front", "back", "side"] as ProgressPhotoPose[]) {
      const path = set[PATH_COLUMNS[pose]];
      const analysisCol = ANALYSIS_COLUMNS[pose];
      if (!path || set[analysisCol]) continue;

      const downloaded = await downloadPhotoBase64(admin, path);
      if (!downloaded) continue;

      try {
        const priorNotes = priorProgressNotesForPose(updated, pose, set.month_key);
        const analysis = await analyzeProgressPhoto(pose, downloaded.base64, downloaded.mimeType, {
          userGoal: profile.goal,
          locale: profile.preferred_locale,
          priorProgressNotes: priorNotes,
          profileGender: profile.gender,
          identityBaseline,
        });
        await saveAnalysisOnSet(admin, set.id, pose, analysis);
        (set[analysisCol] as ProgressPhotoAnalysis | null) = analysis;

        if (analysis.valid && !profileHasProgressPhotoIdentity(identityBaseline)) {
          const identity = buildProgressPhotoIdentityFromAnalysis(
            analysis,
            set.month_key,
            pose
          );
          if (identity) {
            identityBaseline = identity;
            await admin
              .from("profiles")
              .update({ progress_photo_identity: identity })
              .eq("id", profile.id);
          }
        }
      } catch {
        // skip — chat may still attach raw images
      }
    }
  }

  return updated;
}

export async function loadProgressPhotosForChat(input: {
  clientId: string;
  message: string;
  admin: SupabaseClient;
  profile: Profile;
  hasUserAttachedImage: boolean;
  existingSets?: ProgressPhotoSet[];
}): Promise<{
  attachments: ProgressPhotoChatAttachment[];
  sets: ProgressPhotoSet[];
}> {
  const existingSets =
    input.existingSets ?? (await getProgressPhotoSetsWithAnalysis(input.clientId, 12));

  if (!shouldAttachProgressPhotosToChat(input.message, input.hasUserAttachedImage)) {
    return { attachments: [], sets: existingSets };
  }

  let sets = existingSets;
  if (!sets.some(progressSetHasPhotos)) {
    return { attachments: [], sets };
  }

  sets = await backfillMissingProgressPhotoAnalyses(input.admin, input.profile, sets);

  const candidates = collectPhotoCandidates(sets, input.message);
  const attachments: ProgressPhotoChatAttachment[] = [];

  for (const candidate of candidates) {
    const downloaded = await downloadPhotoBase64(input.admin, candidate.path);
    if (!downloaded) continue;
    attachments.push({
      ...downloaded,
      label: `${candidate.monthKey} ${candidate.pose}`,
      monthKey: candidate.monthKey,
      pose: candidate.pose,
    });
  }

  return { attachments, sets };
}

export function buildProgressPhotoVisionPrompt(attachments: ProgressPhotoChatAttachment[]): string {
  if (attachments.length === 0) return "";

  const list = attachments.map((item, i) => `${i + 1}. ${item.label}`).join("\n");
  return `

Progress photos attached to this message (${attachments.length} image${attachments.length === 1 ? "" : "s"}):
${list}

These are the client's stored monthly check-in photos from the app — NOT a random upload. Look at every attached image before answering.
Give personalized physique/progress feedback for THIS client: visible changes across months, muscle groups to prioritize, what looks underdeveloped, and specific training/nutrition focus — not generic advice.
Compare poses/months when multiple images are present. Be direct and specific about what you actually see.`;
}
