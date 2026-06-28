import type {
  ProgressPhotoAnalysis,
  ProgressPhotoApparentSex,
  ProgressPhotoIdentity,
  ProgressPhotoPose,
} from "@/lib/types";
import { formatGender } from "@/lib/intake-display";

export function gendersConflict(
  profileGender: string | null | undefined,
  detectedSex: ProgressPhotoApparentSex | undefined
): boolean {
  if (!profileGender || !detectedSex) return false;
  if (detectedSex === "ambiguous" || detectedSex === "unknown") return false;
  if (profileGender === "male" && detectedSex === "female") return true;
  if (profileGender === "female" && detectedSex === "male") return true;
  return false;
}

function defaultRejectMessage(
  subject: "gender_mismatch" | "different_person",
  locale?: string | null,
  profileGender?: string | null
): string {
  const al = locale === "al";
  if (subject === "gender_mismatch") {
    const genderLabel = formatGender(profileGender) ?? (al ? "profilit tuaj" : "your profile");
    return al
      ? `Kjo foto nuk përputhet me gjininë ${genderLabel.toLowerCase()} në profil. Progresi kërkon foto të tua — jo të dikujt tjetër. Ribëje me kamerën.`
      : `That photo doesn't match the ${genderLabel.toLowerCase()} on your profile. Progress tracking means YOUR body — not someone else's. Retake it with the camera.`;
  }
  return al
    ? "Ky nuk je ti — ose nuk është i njëjti person si në foton e parë të progresit. Çdo muaj duhet të jesh ti në foto. Nëse gabimisht përdore dikë tjetër në foton e parë, kontakto suportin për ta rivendosur."
    : "That's not you — or not the same person as in your first progress photo. Every check-in has to be the same body in the photos. Used someone else on photo one by mistake? Contact support and we can reset it.";
}

function invalidateAnalysis(
  analysis: ProgressPhotoAnalysis,
  subject: "gender_mismatch" | "different_person",
  options?: { locale?: string | null; profileGender?: string | null; alexMessage?: string }
): ProgressPhotoAnalysis {
  return {
    ...analysis,
    valid: false,
    detected_subject: subject,
    identity_match: subject === "different_person" ? false : analysis.identity_match,
    rejection_reason:
      subject === "gender_mismatch"
        ? "Gender does not match profile"
        : "Different person than established baseline",
    alex_message:
      options?.alexMessage?.trim() ||
      defaultRejectMessage(subject, options?.locale, options?.profileGender),
  };
}

/** Apply server-side identity rules after AI vision parse. */
export function finalizeProgressPhotoAnalysis(
  analysis: ProgressPhotoAnalysis,
  options?: {
    profileGender?: string | null;
    identityBaseline?: ProgressPhotoIdentity | null;
    locale?: string | null;
  }
): ProgressPhotoAnalysis {
  if (!analysis.valid) return analysis;

  if (gendersConflict(options?.profileGender, analysis.detected_apparent_sex)) {
    return invalidateAnalysis(analysis, "gender_mismatch", {
      locale: options?.locale,
      profileGender: options?.profileGender,
      alexMessage: analysis.alex_message,
    });
  }

  if (
    options?.identityBaseline?.signature &&
    analysis.identity_match === false
  ) {
    return invalidateAnalysis(analysis, "different_person", {
      locale: options?.locale,
      alexMessage: analysis.alex_message,
    });
  }

  return analysis;
}

export function buildProgressPhotoIdentityFromAnalysis(
  analysis: ProgressPhotoAnalysis,
  monthKey: string,
  pose: ProgressPhotoPose
): ProgressPhotoIdentity | null {
  const signature = analysis.identity_signature?.trim();
  if (!signature) return null;

  return {
    signature,
    apparent_sex: analysis.detected_apparent_sex ?? "ambiguous",
    established_at: new Date().toISOString(),
    established_from_month_key: monthKey,
    established_from_pose: pose,
  };
}

export function profileHasProgressPhotoIdentity(
  identity: ProgressPhotoIdentity | null | undefined
): boolean {
  return Boolean(identity?.signature?.trim());
}
