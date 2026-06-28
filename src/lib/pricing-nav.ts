import { isTrainPath } from "@/lib/train-nav";

export const PRICING_PATH = "/dashboard/pricing";

export function isValidPricingReturnPath(path: string): boolean {
  if (!path.startsWith("/dashboard")) return false;
  if (path === PRICING_PATH || path.startsWith(`${PRICING_PATH}/`)) return false;
  if (path === "/dashboard/checkout" || path.startsWith("/dashboard/checkout/")) return false;
  return true;
}

export function buildPricingHref(
  fromPath: string,
  extra?: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) params.set(key, value);
  }
  if (isValidPricingReturnPath(fromPath)) {
    params.set("from", fromPath);
  }
  const query = params.toString();
  return query ? `${PRICING_PATH}?${query}` : PRICING_PATH;
}

export function parsePricingReturnPath(from: string | null | undefined): string {
  if (!from || !isValidPricingReturnPath(from)) return "/dashboard";
  return from;
}

export function getPricingReturnLabel(
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
