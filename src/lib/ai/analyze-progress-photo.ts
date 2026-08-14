import type { ProgressPhotoAnalysis, ProgressPhotoIdentity, ProgressPhotoPose } from "@/lib/types";
import { clampConfidence, parseJsonObject } from "@/lib/ai/parse-json";
import {
  finalizeProgressPhotoAnalysis,
} from "@/lib/progress-photo-identity";
import { runVisionPrompt } from "@/lib/ai/providers";
import { calculateBmi, getBmiCategory } from "@/lib/bmi-utils";
import { formatGender } from "@/lib/intake-display";
import { buildAlexMessageLanguageRule } from "@/lib/ai/language-instructions";

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

export type ProgressPhotoBodyContext = {
  heightCm?: number | null;
  weightKg?: number | null;
};

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

function bodyMetricsBlock(body?: ProgressPhotoBodyContext | null): string {
  const heightCm = body?.heightCm;
  const weightKg = body?.weightKg;
  const hasHeight = heightCm != null && Number.isFinite(heightCm);
  const hasWeight = weightKg != null && Number.isFinite(weightKg);

  if (!hasHeight && !hasWeight) {
    return `Body metrics on file: none (height/weight missing). Rely on what you see in the photo — still be honest about visible adiposity and muscle.`;
  }

  const parts: string[] = [];
  if (hasWeight) parts.push(`${weightKg} kg`);
  if (hasHeight) parts.push(`${heightCm} cm`);

  let bmiLine = "";
  if (hasHeight && hasWeight) {
    const bmi = calculateBmi(weightKg!, heightCm!);
    const category = bmi != null ? getBmiCategory(bmi) : null;
    if (bmi != null && category) {
      bmiLine = ` BMI ~${bmi.toFixed(1)} (${category}). Use as supporting context — the PHOTO is primary.`;
    }
  }

  return `Body metrics on file: ${parts.join(", ")}.${bmiLine}
If metrics and the photo both show clear excess body fat, treat it as a real fat-loss / recomposition job — not a "small tweak."`;
}

function buildPrompt(
  expectedPose: ProgressPhotoPose,
  options?: {
    userGoal?: string | null;
    locale?: string | null;
    priorProgressNotes?: string | null;
    profileGender?: string | null;
    identityBaseline?: ProgressPhotoIdentity | null;
    body?: ProgressPhotoBodyContext | null;
  }
): string {
  const language = buildAlexMessageLanguageRule(options?.locale);

  const genderLine = options?.profileGender
    ? `Profile gender (from intake): ${formatGender(options.profileGender) ?? options.profileGender}`
    : "Profile gender: not set — still enforce same-person rules once a baseline exists.";

  const identityBlock = options?.identityBaseline?.signature
    ? `Established progress-photo baseline — every future photo MUST show this same person:
${options.identityBaseline.signature}
If the person in this image appears to be a DIFFERENT individual, set valid=false, detected_subject=different_person, identity_match=false. Write a sarcastic alex_message calling out that they swapped in someone else. If they may have used the wrong person on their first photo by mistake, tell them to contact support to reset their progress photos — do NOT use the word "identity" in alex_message (users find it alarming).`
    : `No progress-photo baseline yet — this may be their FIRST accepted progress photo.
IMPORTANT: The first valid photo sets who must appear in all future monthly check-ins. Reject if they are clearly using someone else's body as a placeholder.
If valid, you MUST output identity_signature: a neutral 2-4 sentence physical description to recognize this person later (build, hair, skin tone, height impression, approximate age, visible body composition — no names).`;

  return `You are Coach Alex — a sarcastic, darkly funny, relentlessly motivating personal trainer reviewing a progress/check-in photo inside a fitness app. You talk like the coach who roasts soft excuses between sets but still makes sure people get results. Honesty first. Flattery without evidence is a lie.

Expected pose for this slot: ${expectedPose.toUpperCase()}
${poseInstructions(expectedPose)}

${genderLine}
${bodyMetricsBlock(options?.body)}
User goal: ${options?.userGoal ?? "general fitness / body recomposition"}
${options?.priorProgressNotes ? `Prior progress photo notes (for comparison if this photo is valid):\n${options.priorProgressNotes}` : ""}

${identityBlock}

Tasks:
1. VALIDITY — Is this a real progress photo of a person in (or close to) the expected ${expectedPose} pose?
   - INVALID if: not a person, random object (car, food, pet, room, meme, screenshot), wrong pose (e.g. back when front expected), face-only selfie with no body, completely unusable blur/darkness.
   - VALID if: a person in roughly the correct ${expectedPose} fitness check-in pose, even if lighting/quality is imperfect.
2. GENDER CHECK — If profile gender is Male, reject photos that clearly show a female-presenting adult (detected_apparent_sex=female). If profile gender is Female, reject clearly male-presenting adults. Set valid=false, detected_subject=gender_mismatch. Be conservative if ambiguous — only reject when reasonably confident.
3. SAME PERSON — If an identity baseline exists above, compare the person in this photo. If clearly a different person, set valid=false, detected_subject=different_person, identity_match=false. If same person, identity_match=true.
4. If INVALID (wrong pose/object/etc): set valid=false. Write alex_message as a short sarcastic roast (1–3 sentences).
5. If VALID: set valid=true, detected_subject=person_fitness_pose. Then READ THE PHYSIQUE HONESTLY and write coaching copy.

Physique reading (when VALID) — do this carefully:
- Judge visible body fat, soft tissue, waist/hip/stomach profile, muscle presence, posture, and symmetry from what you can actually see.
- If they look clearly overweight / carry substantial excess fat (roughly midsection, hips, arms, face softness — e.g. someone who likely has ~20–30+ kg to lose), you MUST say so clearly. Do NOT soften it into "you look good", "you're fine", "you're okay", or "just a little work left."
- Match severity to reality: mild softness ≠ "a bit of work"; large excess fat = real cut + training project. Name the priority (fat loss, build base strength, tighten midsection, etc.).
- If they look lean / athletic / have visible abs or low body fat, say that specifically. Priority should be ADDING MUSCLE / healthy weight gain and fixing weak points — NOT a fat-loss cut, NOT "too much pizza," NOT inventing junk-food habits.
- Respect User goal: if goal is gain weight, build muscle, or similar and the photo is lean/soft-lean, push surplus + hypertrophy. Only push a cut when excess fat is clearly visible or the goal is fat loss.
- Prefer concrete observations (midsection roundness, lack of muscle separation, soft upper arms, posture tilt, underdeveloped back/legs) over vague vibes.
- If lighting/pose hides detail, say what you can and cannot assess — never invent abs or invent obesity.

alex_message tone when VALID (2–4 sentences):
- Sarcastic, motivational, gym-floor tough love. Make them want to train and show up next month.
- Deliver the hard truth first (or woven into the joke), then a clear next step and a motivating closer.
- Roast denial and comfort zones — never their worth as a person. No cruel insults, no mocking faces/protected traits, no body-hate language. Tough love ≠ humiliation.
- Bad: "You look good, we have a bit of work but you're okay." / "Time for a cut, too much pizza" when they already look lean.
- Good vibe when excess fat is obvious: "That's not a 'small polish' photo — there's real fat to lose here and the midsection is doing most of the talking. Cut clean, lift hard, next check-in better look different."
- Good vibe when lean / needs muscle: "Abs are already clocking in — cute. Now put some meat on the frame. Progressive overload, protein, and stop treating your upper back like a rumor."

Also fill:
- physique_observations: 2–5 honest bullets (adiposity + muscle + posture), matching what you see.
- progress_notes: comparison to prior notes if any; else baseline frank summary.
- focus_areas / missing_areas: training/nutrition priorities grounded in the photo.

Rules:
- ${language}
- Roast cheating with wrong photos. On valid photos, be honest about the body you see — sugarcoating is forbidden.
- Be conservative only when the image is unclear: say you cannot tell, rather than inventing detail. When excess fat is obvious, do not hedge into false reassurance.

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
    body?: ProgressPhotoBodyContext | null;
  }
): Promise<ProgressPhotoAnalysis> {
  const prompt = buildPrompt(expectedPose, options);
  const raw = await runVisionPrompt(prompt, imageBase64, mimeType);
  return parseAnalysis(raw, expectedPose, options);
}
