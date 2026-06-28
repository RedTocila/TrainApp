import { CANONICAL_SITE_ORIGIN } from "@/lib/site-config";

/** Public share link for a challenge — always uses the production domain. */
export function getChallengeShareUrl(slug: string): string {
  return `${CANONICAL_SITE_ORIGIN}/dashboard/challenges/${slug}`;
}
