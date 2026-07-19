/**
 * Challenge cover art lives in `/public/challenges/cards/`.
 * Drop PNG/WebP files there using the paths below — the UI already reserves space.
 *
 * Naming convention (current):
 *   transformation-{30-day|90-day|6-month|12-month}{-men|-women}.png
 *   flash-{longest-plank|longest-wall-sit|most-burpees-10min}.png
 */

import { getChallengeGender, getTransformationTierKey } from "@/lib/challenge-gender";
import { isFlashChallenge } from "@/lib/challenge-series";
import type { FlashChallengeSlug } from "@/lib/flash-challenge-catalog";
import type { TransformationTierKey } from "@/lib/transformation-challenges";
import type { Challenge } from "@/lib/types";

export type ChallengeMediaIconKey =
  | "flame"
  | "trophy"
  | "medal"
  | "dumbbell"
  | "timer"
  | "zap";

export type ChallengeCardVisual = {
  /** Absolute public URL, e.g. `/challenges/cards/….png` — leave mapped; replace file anytime */
  coverImage: string | null;
  gradient: string;
  border: string;
  shadow: string;
  badge: string;
  /** String key so Server Components can pass visuals into Client Components safely */
  icon: ChallengeMediaIconKey;
};

const LONG_COVERS: Record<
  TransformationTierKey,
  { men: string; women: string }
> = {
  "30-day": {
    men: "/challenges/cards/transformation-30-day-men.png",
    women: "/challenges/cards/transformation-30-day-women.png",
  },
  "90-day": {
    men: "/challenges/cards/transformation-90-day-men.png",
    women: "/challenges/cards/transformation-90-day-women.png",
  },
  "6-month": {
    men: "/challenges/cards/transformation-6-month-men.png",
    women: "/challenges/cards/transformation-6-month-women.png",
  },
  "12-month": {
    men: "/challenges/cards/transformation-12-month-men.png",
    women: "/challenges/cards/transformation-12-month-women.png",
  },
};

const FLASH_COVERS: Record<FlashChallengeSlug, string> = {
  "flash-longest-plank": "/challenges/cards/flash-longest-plank.png",
  "flash-longest-wall-sit": "/challenges/cards/flash-longest-wall-sit.png",
  "flash-most-burpees-10min": "/challenges/cards/flash-most-burpees-10min.png",
};

const LONG_VISUALS: Record<
  TransformationTierKey,
  Omit<ChallengeCardVisual, "coverImage">
> = {
  "30-day": {
    gradient: "from-orange-600 via-orange-500 to-amber-700",
    border: "border-orange-500/30",
    shadow: "shadow-orange-500/10",
    badge: "border-orange-300/40 bg-orange-500/20 text-orange-50",
    icon: "flame",
  },
  "90-day": {
    gradient: "from-violet-700 via-violet-600 to-indigo-900",
    border: "border-violet-500/30",
    shadow: "shadow-violet-500/10",
    badge: "border-violet-300/40 bg-violet-500/20 text-violet-50",
    icon: "trophy",
  },
  "6-month": {
    gradient: "from-sky-700 via-blue-700 to-slate-900",
    border: "border-sky-500/30",
    shadow: "shadow-sky-500/10",
    badge: "border-sky-300/40 bg-sky-500/20 text-sky-50",
    icon: "medal",
  },
  "12-month": {
    gradient: "from-rose-900 via-neutral-900 to-black",
    border: "border-rose-500/30",
    shadow: "shadow-rose-500/10",
    badge: "border-rose-300/40 bg-rose-500/20 text-rose-50",
    icon: "dumbbell",
  },
};

const FLASH_VISUALS: Record<
  FlashChallengeSlug,
  Omit<ChallengeCardVisual, "coverImage">
> = {
  "flash-longest-plank": {
    gradient: "from-amber-500 via-orange-600 to-red-800",
    border: "border-orange-500/30",
    shadow: "shadow-orange-500/10",
    badge: "border-orange-300/40 bg-orange-500/20 text-orange-50",
    icon: "timer",
  },
  "flash-longest-wall-sit": {
    gradient: "from-fuchsia-600 via-pink-600 to-rose-900",
    border: "border-pink-500/30",
    shadow: "shadow-pink-500/10",
    badge: "border-pink-300/40 bg-pink-500/20 text-pink-50",
    icon: "zap",
  },
  "flash-most-burpees-10min": {
    gradient: "from-lime-500 via-emerald-600 to-teal-900",
    border: "border-lime-500/30",
    shadow: "shadow-lime-500/10",
    badge: "border-lime-300/40 bg-lime-500/20 text-lime-50",
    icon: "flame",
  },
};

export function getChallengeCoverSrc(
  challenge: Pick<
    Challenge,
    "slug" | "gender" | "is_flash" | "is_transformation" | "cover_image"
  >
): string | null {
  const custom = challenge.cover_image?.trim();
  if (custom) return custom;

  if (isFlashChallenge(challenge)) {
    return FLASH_COVERS[challenge.slug as FlashChallengeSlug] ?? null;
  }
  const tier = getTransformationTierKey(challenge.slug) as TransformationTierKey | null;
  if (!tier || !LONG_COVERS[tier]) return null;
  const gender = getChallengeGender(challenge);
  return gender === "female" ? LONG_COVERS[tier].women : LONG_COVERS[tier].men;
}

export function getChallengeCardVisual(
  challenge: Pick<
    Challenge,
    "slug" | "gender" | "is_flash" | "is_transformation" | "cover_image"
  >
): ChallengeCardVisual {
  if (isFlashChallenge(challenge)) {
    const slug = challenge.slug as FlashChallengeSlug;
    const base = FLASH_VISUALS[slug] ?? FLASH_VISUALS["flash-longest-plank"];
    return {
      ...base,
      coverImage: getChallengeCoverSrc(challenge),
    };
  }

  const tier =
    (getTransformationTierKey(challenge.slug) as TransformationTierKey | null) ??
    "90-day";
  const base = LONG_VISUALS[tier] ?? LONG_VISUALS["90-day"];
  return {
    ...base,
    coverImage: getChallengeCoverSrc(challenge),
  };
}
