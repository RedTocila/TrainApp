import { createAdminClient } from "@/lib/supabase/admin";
import type { Challenge } from "@/lib/types";

export const FLASH_CHALLENGE_SLUGS = [
  "flash-longest-plank",
  "flash-longest-wall-sit",
  "flash-most-burpees-10min",
] as const;

export type FlashChallengeSlug = (typeof FLASH_CHALLENGE_SLUGS)[number];

export const FLASH_CHALLENGE_IDS: Record<FlashChallengeSlug, string> = {
  "flash-longest-plank": "20000000-0000-4000-8000-000000000001",
  "flash-longest-wall-sit": "20000000-0000-4000-8000-000000000002",
  "flash-most-burpees-10min": "20000000-0000-4000-8000-000000000003",
};

const FLASH_PRIZE_CENTS = 500;
const FLASH_ENTRY_FEE_CENTS = 1000;
const FLASH_MAX_PARTICIPANTS = 50;

function weekStartIso(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

type FlashTemplate = {
  slug: FlashChallengeSlug;
  title: string;
  description: string;
  duration_days: number;
};

const FLASH_TEMPLATES: FlashTemplate[] = [
  {
    slug: "flash-longest-plank",
    title: "Longest Plank",
    description:
      "Hold the longest plank you can on video. **24-hour flash window** once 10 people join. **€10 entry fee** after the first group fills · **50 spots max**.",
    duration_days: 1,
  },
  {
    slug: "flash-longest-wall-sit",
    title: "Longest Wall Sit",
    description:
      "How long can you hold a wall sit? Record your best time within **24 hours** after the challenge goes live. **€10 entry** after the first 10 join · **50 spots max**.",
    duration_days: 1,
  },
  {
    slug: "flash-most-burpees-10min",
    title: "Most Burpees in 10 Min",
    description:
      "Max burpees in 10 minutes — film it on Zoom. **24-hour flash window** · **€10 entry** after the first group fills · **50 spots max**.",
    duration_days: 1,
  },
];

export function buildFlashChallenge(template: FlashTemplate): Challenge {
  const scheduled_at = weekStartIso();

  return {
    id: FLASH_CHALLENGE_IDS[template.slug],
    title: template.title,
    slug: template.slug,
    description: template.description,
    scheduled_at,
    duration_minutes: 60,
    duration_months: 1,
    duration_days: template.duration_days,
    group_size: 10,
    max_participants: FLASH_MAX_PARTICIPANTS,
    is_transformation: false,
    is_flash: true,
    entry_fee_cents: FLASH_ENTRY_FEE_CENTS,
    final_zoom_url: null,
    champion_participant_id: null,
    prize_pool_cents_per_participant: FLASH_PRIZE_CENTS,
    participant_count: 0,
    round_1_zoom_at: null,
    round_2_zoom_at: null,
    round_3_zoom_at: null,
    prize_paid_at: null,
    current_phase: 0,
    published: true,
    created_at: scheduled_at,
  };
}

export function getFlashChallengeCatalog(): Challenge[] {
  return FLASH_TEMPLATES.map(buildFlashChallenge);
}

export function getFlashChallengeBySlug(slug: string): Challenge | undefined {
  const template = FLASH_TEMPLATES.find((t) => t.slug === slug);
  return template ? buildFlashChallenge(template) : undefined;
}

export function isFlashChallengeSlug(slug: string): slug is FlashChallengeSlug {
  return FLASH_CHALLENGE_SLUGS.includes(slug as FlashChallengeSlug);
}

export function getFlashDurationLabel(_challenge: Challenge): string {
  return "24 hours";
}

export async function ensureFlashChallengesInDb(): Promise<void> {
  try {
    const admin = createAdminClient();
    const scheduled_at = weekStartIso();

    for (const template of FLASH_TEMPLATES) {
      const { error } = await admin.from("challenges").upsert(
        {
          id: FLASH_CHALLENGE_IDS[template.slug],
          title: template.title,
          slug: template.slug,
          description: template.description,
          scheduled_at,
          duration_minutes: 60,
          duration_months: 1,
          duration_days: template.duration_days,
          group_size: 10,
          max_participants: FLASH_MAX_PARTICIPANTS,
          is_transformation: false,
          is_flash: true,
          entry_fee_cents: FLASH_ENTRY_FEE_CENTS,
          prize_pool_cents_per_participant: FLASH_PRIZE_CENTS,
          published: true,
          current_phase: 0,
        },
        { onConflict: "slug" }
      );

      if (error) {
        console.warn(`[challenges] Could not upsert ${template.slug}:`, error.message);
      }
    }
  } catch (err) {
    console.warn("[challenges] ensureFlashChallengesInDb failed:", err);
  }
}

export function mergeFlashChallenges(dbChallenges: Challenge[]): Challenge[] {
  const bySlug = new Map<string, Challenge>();

  for (const catalog of getFlashChallengeCatalog()) {
    bySlug.set(catalog.slug, catalog);
  }

  for (const row of dbChallenges) {
    const existing = bySlug.get(row.slug);
    bySlug.set(row.slug, existing ? { ...existing, ...row } : row);
  }

  return FLASH_CHALLENGE_SLUGS.map((slug) => bySlug.get(slug)).filter(
    (c): c is Challenge => c != null
  );
}
