import { suggestChallengeZoomDates } from "@/lib/challenge-utils";
import {
  TRANSFORMATION_CHALLENGE_SLUGS,
  type TransformationChallengeSlug,
} from "@/lib/transformation-challenges";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Challenge } from "@/lib/types";

export const TRANSFORMATION_CHALLENGE_IDS: Record<TransformationChallengeSlug, string> = {
  "transformation-30-day": "10000000-0000-4000-8000-000000000030",
  "transformation-90-day": "10000000-0000-4000-8000-000000000090",
  "transformation-6-month": "10000000-0000-4000-8000-000000000180",
  "transformation-12-month": "10000000-0000-4000-8000-000000000360",
};

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

type TransformationTemplate = {
  slug: TransformationChallengeSlug;
  title: string;
  description: string;
  duration_months: number;
  duration_days: number | null;
};

const TRANSFORMATION_TEMPLATES: TransformationTemplate[] = [
  {
    slug: "transformation-30-day",
    title: "30-Day Transformation Challenge",
    description:
      "Commit to 30 days of consistent training, nutrition, and habits. **100 spots max** — join the waitlist when full. **+€10 per participant** added to the prize pool each month (up to **€1,000** at full capacity).",
    duration_months: 1,
    duration_days: 30,
  },
  {
    slug: "transformation-90-day",
    title: "90-Day Transformation Challenge",
    description:
      "A full quarter to transform your physique and build lasting habits. **100 spots max** with a FIFO waitlist when full. **+€10 per participant per month** (up to **€3,000** at full capacity).",
    duration_months: 3,
    duration_days: 90,
  },
  {
    slug: "transformation-6-month",
    title: "6-Month Transformation Challenge",
    description:
      "Six months of structured progress toward your best shape. Long-form tournament with monthly elimination Zoom days. **100 spots max**. **+€10 per participant per month** (up to **€6,000** at full capacity).",
    duration_months: 6,
    duration_days: null,
  },
  {
    slug: "transformation-12-month",
    title: "12-Month Transformation Challenge",
    description:
      "The ultimate year-long transformation journey. Twelve months of logging, AI coaching, and live Zoom eliminations. **100 spots max**. **+€10 per participant per month** (up to **€12,000** at full capacity).",
    duration_months: 12,
    duration_days: null,
  },
];

export function buildTransformationChallenge(template: TransformationTemplate): Challenge {
  const scheduled_at = monthStartIso();
  const zoom = suggestChallengeZoomDates(scheduled_at, template.duration_months);

  return {
    id: TRANSFORMATION_CHALLENGE_IDS[template.slug],
    title: template.title,
    slug: template.slug,
    description: template.description,
    scheduled_at,
    duration_minutes: 60,
    duration_months: template.duration_months,
    duration_days: template.duration_days,
    group_size: 10,
    max_participants: 100,
    is_transformation: true,
    is_flash: false,
    entry_fee_cents: 0,
    final_zoom_url: null,
    champion_participant_id: null,
    prize_pool_cents_per_participant: 1000,
    participant_count: 0,
    round_1_zoom_at: zoom.round_1_zoom_at,
    round_2_zoom_at: zoom.round_2_zoom_at,
    round_3_zoom_at: zoom.round_3_zoom_at,
    prize_paid_at: null,
    current_phase: 0,
    published: true,
    created_at: scheduled_at,
  };
}

export function getTransformationChallengeCatalog(): Challenge[] {
  return TRANSFORMATION_TEMPLATES.map(buildTransformationChallenge);
}

export function getTransformationChallengeBySlug(slug: string): Challenge | undefined {
  const template = TRANSFORMATION_TEMPLATES.find((t) => t.slug === slug);
  return template ? buildTransformationChallenge(template) : undefined;
}

export function isTransformationChallengeSlug(slug: string): slug is TransformationChallengeSlug {
  return TRANSFORMATION_CHALLENGE_SLUGS.includes(slug as TransformationChallengeSlug);
}

/** Upsert the four transformation challenges so registration works without manual migration. */
export async function ensureTransformationChallengesInDb(): Promise<void> {
  try {
    const admin = createAdminClient();
    const scheduled_at = monthStartIso();

    for (const template of TRANSFORMATION_TEMPLATES) {
      const zoom = suggestChallengeZoomDates(scheduled_at, template.duration_months);
      const { error } = await admin.from("challenges").upsert(
        {
          id: TRANSFORMATION_CHALLENGE_IDS[template.slug],
          title: template.title,
          slug: template.slug,
          description: template.description,
          scheduled_at,
          duration_minutes: 60,
          duration_months: template.duration_months,
          duration_days: template.duration_days,
          group_size: 10,
          max_participants: 100,
          is_transformation: true,
          is_flash: false,
          entry_fee_cents: 0,
          prize_pool_cents_per_participant: 1000,
          round_1_zoom_at: zoom.round_1_zoom_at,
          round_2_zoom_at: zoom.round_2_zoom_at,
          round_3_zoom_at: zoom.round_3_zoom_at,
          published: true,
          current_phase: 0,
        },
        { onConflict: "slug" }
      );

      if (error) {
        console.warn(
          `[challenges] Could not upsert ${template.slug}:`,
          error.message
        );
      }
    }
  } catch (err) {
    console.warn("[challenges] ensureTransformationChallengesInDb failed:", err);
  }
}

export function mergeTransformationChallenges(dbChallenges: Challenge[]): Challenge[] {
  const bySlug = new Map<string, Challenge>();

  for (const catalog of getTransformationChallengeCatalog()) {
    bySlug.set(catalog.slug, catalog);
  }

  for (const row of dbChallenges) {
    const existing = bySlug.get(row.slug);
    bySlug.set(row.slug, existing ? { ...existing, ...row } : row);
  }

  return TRANSFORMATION_CHALLENGE_SLUGS.map((slug) => bySlug.get(slug)).filter(
    (c): c is Challenge => c != null
  );
}

export function getTransformationDurationLabel(challenge: Challenge): string {
  if (challenge.duration_days === 30) return "30 days";
  if (challenge.duration_days === 90) return "90 days";
  if (challenge.duration_months === 6) return "6 months";
  if (challenge.duration_months === 12) return "12 months";
  if (challenge.duration_days) return `${challenge.duration_days} days`;
  return `${challenge.duration_months} months`;
}
