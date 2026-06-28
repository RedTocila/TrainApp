import { createClient } from "@/lib/supabase/server";
import type {
  ProgressPhotoAnalysis,
  ProgressPhotoPose,
  ProgressPhotoSet,
} from "@/lib/types";
import { progressSetHasPhotos } from "@/lib/progress-photo-utils";

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

function formatAnalysisBlock(
  pose: ProgressPhotoPose,
  analysis: ProgressPhotoAnalysis | null | undefined,
  hasPath: boolean
): string | null {
  if (!hasPath) return null;
  if (!analysis) {
    return `  ${pose.toUpperCase()}: uploaded (attached to chat for live vision review)`;
  }
  const lines: string[] = [`  ${pose.toUpperCase()}:`];
  if (!analysis.valid) {
    lines.push(`    REJECTED — ${analysis.rejection_reason ?? analysis.detected_subject}`);
    lines.push(`    Alex: ${analysis.alex_message}`);
    return lines.join("\n");
  }
  lines.push(`    Alex: ${analysis.alex_message}`);
  if (analysis.physique_observations?.length) {
    lines.push(`    Observations: ${analysis.physique_observations.join("; ")}`);
  }
  if (analysis.progress_notes) {
    lines.push(`    Progress: ${analysis.progress_notes}`);
  }
  if (analysis.focus_areas?.length) {
    lines.push(`    Focus more on: ${analysis.focus_areas.join(", ")}`);
  }
  if (analysis.missing_areas?.length) {
    lines.push(`    Possibly missing / undertrained: ${analysis.missing_areas.join(", ")}`);
  }
  return lines.join("\n");
}

function summarizeSet(set: ProgressPhotoSet): string | null {
  if (!progressSetHasPhotos(set)) return null;
  const blocks = (["front", "back", "side"] as ProgressPhotoPose[])
    .map((pose) => {
      const col = ANALYSIS_COLUMNS[pose];
      const path = set[PATH_COLUMNS[pose]];
      if (!path) return null;
      return formatAnalysisBlock(pose, set[col] as ProgressPhotoAnalysis | null, true);
    })
    .filter(Boolean);
  if (blocks.length === 0) return null;
  return `- ${set.month_key} (cycle started ${set.created_at.slice(0, 10)}):\n${blocks.join("\n")}`;
}

export async function getProgressPhotoSetsWithAnalysis(
  clientId: string,
  limit = 12
): Promise<ProgressPhotoSet[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("progress_photo_sets")
    .select(
      "id, client_id, month_key, front_path, back_path, side_path, front_analysis, back_analysis, side_analysis, created_at, updated_at"
    )
    .eq("client_id", clientId)
    .order("month_key", { ascending: false })
    .limit(limit);
  return (data ?? []) as ProgressPhotoSet[];
}

/** Text block injected into Coach Alex system prompts and reports. */
export function buildProgressPhotoContextFromSets(sets: ProgressPhotoSet[]): string {
  const withPhotos = sets.filter(progressSetHasPhotos);
  if (withPhotos.length === 0) {
    return "No progress photos uploaded yet. Encourage monthly front/back/side check-ins with the camera.";
  }

  const summarized = withPhotos.map(summarizeSet).filter(Boolean);
  const invalidRecent = withPhotos.flatMap((set) =>
    (["front", "back", "side"] as ProgressPhotoPose[])
      .map((pose) => {
        const analysis = set[ANALYSIS_COLUMNS[pose]] as ProgressPhotoAnalysis | null;
        if (!set[PATH_COLUMNS[pose]] || !analysis || analysis.valid) return null;
        return `${set.month_key} ${pose}: ${analysis.alex_message}`;
      })
      .filter(Boolean)
  );

  const latestValidFocus = withPhotos.flatMap((set) =>
    (["front", "back", "side"] as ProgressPhotoPose[]).flatMap((pose) => {
      const analysis = set[ANALYSIS_COLUMNS[pose]] as ProgressPhotoAnalysis | null;
      if (!analysis?.valid) return [];
      return [...(analysis.focus_areas ?? []), ...(analysis.missing_areas ?? [])];
    })
  );

  const uniqueFocus = [...new Set(latestValidFocus)].slice(0, 8);

  let block = `Progress photos (Coach Alex vision analysis):\n${summarized.join("\n")}`;

  if (invalidRecent.length > 0) {
    block += `\n\nRecent invalid/wrong progress photos (call out if relevant — user may need to retake):\n${invalidRecent.slice(0, 3).map((line) => `- ${line}`).join("\n")}`;
  }

  if (uniqueFocus.length > 0) {
    block += `\n\nRecurring physique focus from photos: ${uniqueFocus.join("; ")}`;
  }

  const latest = withPhotos[0];
  const posesMissing = (["front", "back", "side"] as ProgressPhotoPose[]).filter(
    (pose) => !latest[PATH_COLUMNS[pose]]
  );
  if (posesMissing.length > 0) {
    block += `\n\nLatest month (${latest.month_key}) missing poses: ${posesMissing.join(", ")}`;
  }

  return block;
}

export async function buildProgressPhotoContextForAi(clientId: string): Promise<string> {
  const sets = await getProgressPhotoSetsWithAnalysis(clientId, 12);
  return buildProgressPhotoContextFromSets(sets);
}

/** Prior progress notes for same pose from earlier months (for comparison during analysis). */
export function priorProgressNotesForPose(
  sets: ProgressPhotoSet[],
  pose: ProgressPhotoPose,
  beforeMonthKey: string
): string | null {
  const col = ANALYSIS_COLUMNS[pose];
  const notes = sets
    .filter((set) => set.month_key < beforeMonthKey && set[PATH_COLUMNS[pose]])
    .map((set) => {
      const analysis = set[col] as ProgressPhotoAnalysis | null;
      if (!analysis?.valid) return null;
      const parts = [
        analysis.progress_notes,
        analysis.physique_observations?.join("; "),
      ].filter(Boolean);
      return parts.length ? `${set.month_key}: ${parts.join(" — ")}` : null;
    })
    .filter(Boolean);
  return notes.length ? notes.join("\n") : null;
}

export type ProgressPhotoCoachSummary = {
  hasPhotos: boolean;
  latestMonthKey: string | null;
  missingPoses: ProgressPhotoPose[];
  invalidCount: number;
  focusAreas: string[];
  missingAreas: string[];
  latestAlexInsight: string | null;
};

export function summarizeProgressPhotosForCoach(
  sets: ProgressPhotoSet[]
): ProgressPhotoCoachSummary {
  const withPhotos = sets.filter(progressSetHasPhotos);
  const latest = withPhotos[0] ?? null;

  const missingPoses = latest
    ? (["front", "back", "side"] as ProgressPhotoPose[]).filter(
        (pose) => !latest[PATH_COLUMNS[pose]]
      )
    : (["front", "back", "side"] as ProgressPhotoPose[]);

  let invalidCount = 0;
  const focusAreas: string[] = [];
  const missingAreas: string[] = [];
  let latestAlexInsight: string | null = null;

  for (const set of withPhotos) {
    for (const pose of ["front", "back", "side"] as ProgressPhotoPose[]) {
      const analysis = set[ANALYSIS_COLUMNS[pose]] as ProgressPhotoAnalysis | null;
      if (!analysis) continue;
      if (!analysis.valid) invalidCount += 1;
      if (analysis.valid) {
        focusAreas.push(...(analysis.focus_areas ?? []));
        missingAreas.push(...(analysis.missing_areas ?? []));
        if (!latestAlexInsight && set === latest) {
          latestAlexInsight = analysis.alex_message;
        }
      }
    }
  }

  return {
    hasPhotos: withPhotos.length > 0,
    latestMonthKey: latest?.month_key ?? null,
    missingPoses,
    invalidCount,
    focusAreas: [...new Set(focusAreas)].slice(0, 6),
    missingAreas: [...new Set(missingAreas)].slice(0, 6),
    latestAlexInsight,
  };
}
