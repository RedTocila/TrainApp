import type { ProgressPhotoAnalysis, ProgressPhotoPose } from "@/lib/types";
import { clampConfidence, parseJsonObject } from "@/lib/ai/parse-json";
import { runVisionPrompt } from "@/lib/ai/providers";

const POSES: ProgressPhotoPose[] = ["front", "back", "side"];

const SUBJECTS = [
  "person_fitness_pose",
  "wrong_pose",
  "not_a_person",
  "unclear",
] as const;

function poseInstructions(pose: ProgressPhotoPose): string {
  switch (pose) {
    case "front":
      return "FRONT: person facing the camera, chest/torso visible toward camera, arms relaxed at sides or slightly out. Not their back or pure profile.";
    case "back":
      return "BACK: person facing away from camera, back/shoulders visible. Not front-facing or pure side profile.";
    case "side":
      return "SIDE: person in profile/side view — shoulder and hip line visible from the side. Not front or back.";
  }
}

function buildPrompt(
  expectedPose: ProgressPhotoPose,
  options?: {
    userGoal?: string | null;
    locale?: string | null;
    priorProgressNotes?: string | null;
  }
): string {
  const language =
    options?.locale === "al"
      ? "Write alex_message in Albanian (shqip)."
      : options?.locale === "en"
        ? "Write alex_message in English."
        : "Write alex_message in English unless the user's app is clearly Albanian.";

  return `You are Coach Alex — a sarcastic, darkly funny personal trainer reviewing a progress/check-in photo inside a fitness app.

Expected pose for this slot: ${expectedPose.toUpperCase()}
${poseInstructions(expectedPose)}

User goal: ${options?.userGoal ?? "general fitness / body recomposition"}
${options?.priorProgressNotes ? `Prior progress photo notes (for comparison if this photo is valid):\n${options.priorProgressNotes}` : ""}

Tasks:
1. VALIDITY — Is this a real progress photo of a person in (or close to) the expected ${expectedPose} pose?
   - INVALID if: not a person, random object (car, food, pet, room, meme, screenshot), wrong pose (e.g. back when front expected), face-only selfie with no body, completely unusable blur/darkness.
   - VALID if: a person in roughly the correct ${expectedPose} fitness check-in pose, even if lighting/quality is imperfect.
2. If INVALID: set valid=false, detected_subject to wrong_pose or not_a_person or unclear. Write alex_message as a short sarcastic roast telling them to retake the correct pose — dry humor, gym-coach vibe. Examples of tone (do not copy verbatim): "That's a car, not your progress. Retake the ${expectedPose} photo." / "You gave me your back when I asked for front. Do I look stupid to you? Fix it."
3. If VALID: set valid=true, detected_subject=person_fitness_pose. Write alex_message as 1-2 sentences of useful coaching (can still be witty but helpful). Add physique_observations (what you can see — posture, muscle groups, conditioning), progress_notes (change vs prior notes if provided, otherwise current state), focus_areas (what to prioritize in training), missing_areas (muscle groups or habits that seem underdeveloped based on visible physique — be constructive, never cruel about body/appearance).

Rules:
- ${language}
- No body shaming, no comments on weight as moral judgment, no mockery of disability or protected traits — roast wrong photos and lazy habits, not the person's body.
- Be conservative: if you cannot see enough to judge physique, say so in observations rather than inventing detail.
- Do not diagnose medical conditions.

Respond with ONLY valid JSON (no markdown):
{
  "valid": boolean,
  "expected_pose": "${expectedPose}",
  "detected_subject": "person_fitness_pose" | "wrong_pose" | "not_a_person" | "unclear",
  "detected_pose": "front" | "back" | "side" | "unknown",
  "confidence": number between 0 and 1,
  "rejection_reason": "short reason if invalid, else omit or null",
  "alex_message": "string",
  "physique_observations": ["string"],
  "progress_notes": "string or null",
  "focus_areas": ["string"],
  "missing_areas": ["string"]
}`;
}

function parseAnalysis(
  raw: string,
  expectedPose: ProgressPhotoPose
): ProgressPhotoAnalysis {
  const parsed = parseJsonObject<{
    valid?: boolean;
    expected_pose?: string;
    detected_subject?: string;
    detected_pose?: string;
    confidence?: number;
    rejection_reason?: string | null;
    alex_message?: string;
    physique_observations?: string[];
    progress_notes?: string | null;
    focus_areas?: string[];
    missing_areas?: string[];
  }>(raw);

  const detected_subject = SUBJECTS.includes(
    parsed.detected_subject as (typeof SUBJECTS)[number]
  )
    ? (parsed.detected_subject as ProgressPhotoAnalysis["detected_subject"])
    : "unclear";

  const detected_pose =
    parsed.detected_pose && POSES.includes(parsed.detected_pose as ProgressPhotoPose)
      ? (parsed.detected_pose as ProgressPhotoPose)
      : parsed.detected_pose === "unknown"
        ? "unknown"
        : undefined;

  const valid = Boolean(parsed.valid) && detected_subject === "person_fitness_pose";

  return {
    valid,
    expected_pose: expectedPose,
    detected_subject: valid ? "person_fitness_pose" : detected_subject,
    detected_pose,
    confidence: clampConfidence(parsed.confidence),
    rejection_reason: parsed.rejection_reason?.trim() || undefined,
    alex_message:
      parsed.alex_message?.trim() ||
      (valid
        ? "Photo accepted. Keep showing up — consistency beats perfection."
        : `That's not a valid ${expectedPose} progress photo. Retake it.`),
    physique_observations: (parsed.physique_observations ?? []).filter(Boolean),
    progress_notes: parsed.progress_notes?.trim() || undefined,
    focus_areas: (parsed.focus_areas ?? []).filter(Boolean),
    missing_areas: (parsed.missing_areas ?? []).filter(Boolean),
    analyzed_at: new Date().toISOString(),
  };
}

export async function analyzeProgressPhoto(
  expectedPose: ProgressPhotoPose,
  imageBase64: string,
  mimeType: string,
  options?: {
    userGoal?: string | null;
    locale?: string | null;
    priorProgressNotes?: string | null;
  }
): Promise<ProgressPhotoAnalysis> {
  const prompt = buildPrompt(expectedPose, options);
  const raw = await runVisionPrompt(prompt, imageBase64, mimeType);
  return parseAnalysis(raw, expectedPose);
}
