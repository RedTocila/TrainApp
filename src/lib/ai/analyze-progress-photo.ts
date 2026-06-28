import type { ProgressPhotoAnalysis, ProgressPhotoPose } from "@/lib/types";
import { clampConfidence, parseJsonObject } from "@/lib/ai/parse-json";
import {
  finalizeProgressPhotoAnalysis,
} from "@/lib/progress-photo-identity";
import { runVisionPrompt } from "@/lib/ai/providers";
import { formatGender } from "@/lib/intake-display";
import type { ProgressPhotoIdentity } from "@/lib/types";

const POSES: ProgressPhotoPose[] = ["front", "back", "side"];

const SUBJECTS = [
  "person_fitness_pose",
  "wrong_pose",
  "not_a_person",
  "gender_mismatch",
  "different_person",
  "unclear",
] as const;

const APPARENT_SEX = ["male", "female", "ambiguous", "unknown"] as const;

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
    profileGender?: string | null;
    identityBaseline?: ProgressPhotoIdentity | null;
  }
): string {
  const language =
    options?.locale === "al"
      ? "Write alex_message in Albanian (shqip)."
      : options?.locale === "en"
        ? "Write alex_message in English."
        : "Write alex_message in English unless the user's app is clearly Albanian.";

  const genderLine = options?.profileGender
    ? `Profile gender (from intake): ${formatGender(options.profileGender) ?? options.profileGender}`
    : "Profile gender: not set — still enforce same-person rules once a baseline exists.";

  const identityBlock = options?.identityBaseline?.signature
    ? `Established progress-photo baseline — every future photo MUST show this same person:
${options.identityBaseline.signature}
If the person in this image appears to be a DIFFERENT individual, set valid=false, detected_subject=different_person, identity_match=false. Write a sarcastic alex_message calling out that they swapped in someone else. If they may have used the wrong person on their first photo by mistake, tell them to contact support to reset their progress photos — do NOT use the word "identity" in alex_message (users find it alarming).`
    : `No progress-photo baseline yet — this may be their FIRST accepted progress photo.
IMPORTANT: The first valid photo sets who must appear in all future monthly check-ins. Reject if they are clearly using someone else's body as a placeholder.
If valid, you MUST output identity_signature: a neutral 2-4 sentence physical description to recognize this person later (build, hair, skin tone, height impression, approximate age — no names).`;

  return `You are Coach Alex — a sarcastic, darkly funny personal trainer reviewing a progress/check-in photo inside a fitness app.

Expected pose for this slot: ${expectedPose.toUpperCase()}
${poseInstructions(expectedPose)}

${genderLine}
User goal: ${options?.userGoal ?? "general fitness / body recomposition"}
${options?.priorProgressNotes ? `Prior progress photo notes (for comparison if this photo is valid):\n${options.priorProgressNotes}` : ""}

${identityBlock}

Tasks:
1. VALIDITY — Is this a real progress photo of a person in (or close to) the expected ${expectedPose} pose?
   - INVALID if: not a person, random object (car, food, pet, room, meme, screenshot), wrong pose (e.g. back when front expected), face-only selfie with no body, completely unusable blur/darkness.
   - VALID if: a person in roughly the correct ${expectedPose} fitness check-in pose, even if lighting/quality is imperfect.
2. GENDER CHECK — If profile gender is Male, reject photos that clearly show a female-presenting adult (detected_apparent_sex=female). If profile gender is Female, reject clearly male-presenting adults. Set valid=false, detected_subject=gender_mismatch. Be conservative if ambiguous — only reject when reasonably confident.
3. SAME PERSON — If an identity baseline exists above, compare the person in this photo. If clearly a different person, set valid=false, detected_subject=different_person, identity_match=false. If same person, identity_match=true.
4. If INVALID (wrong pose/object/etc): set valid=false. Write alex_message as a short sarcastic roast.
5. If VALID: set valid=true, detected_subject=person_fitness_pose. Write alex_message as 1-2 sentences of useful coaching. Add physique_observations, progress_notes, focus_areas, missing_areas.

Rules:
- ${language}
- No body shaming — roast cheating with wrong photos, not the person's body.
- Be conservative: if you cannot see enough, say so rather than inventing detail.

Respond with ONLY valid JSON (no markdown):
{
  "valid": boolean,
  "expected_pose": "${expectedPose}",
  "detected_subject": "person_fitness_pose" | "wrong_pose" | "not_a_person" | "gender_mismatch" | "different_person" | "unclear",
  "detected_pose": "front" | "back" | "side" | "unknown",
  "detected_apparent_sex": "male" | "female" | "ambiguous" | "unknown",
  "identity_match": true | false | null,
  "identity_signature": "string or null — required when valid and no baseline exists yet",
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
  expectedPose: ProgressPhotoPose,
  options?: {
    profileGender?: string | null;
    identityBaseline?: ProgressPhotoIdentity | null;
    locale?: string | null;
  }
): ProgressPhotoAnalysis {
  const parsed = parseJsonObject<{
    valid?: boolean;
    expected_pose?: string;
    detected_subject?: string;
    detected_pose?: string;
    detected_apparent_sex?: string;
    identity_match?: boolean | null;
    identity_signature?: string | null;
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

  const detected_apparent_sex = APPARENT_SEX.includes(
    parsed.detected_apparent_sex as (typeof APPARENT_SEX)[number]
  )
    ? (parsed.detected_apparent_sex as ProgressPhotoAnalysis["detected_apparent_sex"])
    : "unknown";

  const detected_pose =
    parsed.detected_pose && POSES.includes(parsed.detected_pose as ProgressPhotoPose)
      ? (parsed.detected_pose as ProgressPhotoPose)
      : parsed.detected_pose === "unknown"
        ? "unknown"
        : undefined;

  let valid =
    Boolean(parsed.valid) &&
    detected_subject === "person_fitness_pose";

  if (
    detected_subject === "gender_mismatch" ||
    detected_subject === "different_person"
  ) {
    valid = false;
  }

  const draft: ProgressPhotoAnalysis = {
    valid,
    expected_pose: expectedPose,
    detected_subject: valid ? "person_fitness_pose" : detected_subject,
    detected_pose,
    detected_apparent_sex,
    identity_match:
      parsed.identity_match === true
        ? true
        : parsed.identity_match === false
          ? false
          : null,
    identity_signature: parsed.identity_signature?.trim() || undefined,
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

  return finalizeProgressPhotoAnalysis(draft, {
    profileGender: options?.profileGender,
    identityBaseline: options?.identityBaseline,
    locale: options?.locale,
  });
}

export async function analyzeProgressPhoto(
  expectedPose: ProgressPhotoPose,
  imageBase64: string,
  mimeType: string,
  options?: {
    userGoal?: string | null;
    locale?: string | null;
    priorProgressNotes?: string | null;
    profileGender?: string | null;
    identityBaseline?: ProgressPhotoIdentity | null;
  }
): Promise<ProgressPhotoAnalysis> {
  const prompt = buildPrompt(expectedPose, options);
  const raw = await runVisionPrompt(prompt, imageBase64, mimeType);
  return parseAnalysis(raw, expectedPose, options);
}
