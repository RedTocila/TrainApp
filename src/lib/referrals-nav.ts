import { isTrainPath } from "@/lib/train-nav";

export const REFERRALS_PATH = "/dashboard/referrals";

export function isValidReferralsReturnPath(path: string): boolean {
  if (!path.startsWith("/dashboard")) return false;
  if (path === REFERRALS_PATH || path.startsWith(`${REFERRALS_PATH}/`)) return false;
  return true;
}

export function buildReferralsHref(fromPath: string): string {
  if (!isValidReferralsReturnPath(fromPath)) {
    return REFERRALS_PATH;
  }
  const params = new URLSearchParams({ from: fromPath });
  return `${REFERRALS_PATH}?${params.toString()}`;
}

export function parseReferralsReturnPath(from: string | null | undefined): string {
  if (!from || !isValidReferralsReturnPath(from)) return "/dashboard";
  return from;
}

export function getReferralsReturnLabel(
  returnPath: string,
  labels: {
    home: string;
    programs: string;
    aiCoach: string;
    liveCoaching: string;
    profile: string;
    back: string;
  }
): string {
  if (returnPath === "/dashboard") return labels.home;
  if (isTrainPath(returnPath)) return labels.programs;
  if (returnPath === "/dashboard/ai" || returnPath.startsWith("/dashboard/ai/")) {
    return labels.aiCoach;
  }
  if (returnPath === "/dashboard/classes" || returnPath.startsWith("/dashboard/classes/")) {
    return labels.liveCoaching;
  }
  if (returnPath.startsWith("/dashboard/challenges/")) {
    return labels.liveCoaching;
  }
  if (returnPath === "/dashboard/profile" || returnPath.startsWith("/dashboard/profile/")) {
    return labels.profile;
  }
  return labels.back;
}
