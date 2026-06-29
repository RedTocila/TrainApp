import { suggestChallengeZoomDates } from "@/lib/challenge-utils";
import {
  TRANSFORMATION_CHALLENGE_SLUGS,
  type TransformationChallengeSlug,
  type TransformationGenderSuffix,
  type TransformationTierKey,
} from "@/lib/transformation-challenges";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Challenge } from "@/lib/types";

export const TRANSFORMATION_CHALLENGE_IDS: Record<TransformationChallengeSlug, string> = {
  "transformation-30-day-men": "10000000-0000-4000-8000-000000000030",
  "transformation-30-day-women": "10000000-0000-4000-8000-000000000031",
  "transformation-90-day-men": "10000000-0000-4000-8000-000000000090",
  "transformation-90-day-women": "10000000-0000-4000-8000-000000000091",
  "transformation-6-month-men": "10000000-0000-4000-8000-000000000180",
  "transformation-6-month-women": "10000000-0000-4000-8000-000000000181",
  "transformation-12-month-men": "10000000-0000-4000-8000-000000000360",
  "transformation-12-month-women": "10000000-0000-4000-8000-000000000361",
};

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

type TransformationTierTemplate = {
  tier: TransformationTierKey;
  title: string;
  descriptionMen: string;
  descriptionWomen: string;
  duration_months: number;
  duration_days: number | null;
};

const TRANSFORMATION_TIER_TEMPLATES: TransformationTierTemplate[] = [
  {
    tier: "30-day",
    title: "30-Day Transformation Challenge",
    descriptionMen:
      "Thirty days. Log everything, show up on Zoom, don't embarrass yourself. **100 spots max** — full? Waitlist. **+€10 per participant** each month (up to **€1,000** when we're packed). Coach Alex is watching.",
    descriptionWomen:
      "Thirty days to prove what you're capable of — and you absolutely are. **100 spots max**; join the waitlist if we're full. **+€10 per participant** grows the pool every month (up to **€1,000** at capacity). Show up for yourself. That's the whole game.",
    duration_months: 1,
    duration_days: 30,
  },
  {
    tier: "90-day",
    title: "90-Day Transformation Challenge",
    descriptionMen:
      "A full quarter to stop making excuses and actually transform. **100 spots max**, FIFO waitlist when full. **+€10 per participant per month** (up to **€3,000**). Half-ass it and you'll be out on Zoom before you know it.",
    descriptionWomen:
      "Ninety days to build real habits and a physique you're proud of. **100 spots max** with a fair waitlist. **+€10 per participant per month** (up to **€3,000**). Consistency beats perfection — Alex knows you can do this.",
    duration_months: 3,
    duration_days: 90,
  },
  {
    tier: "6-month",
    title: "6-Month Transformation Challenge",
    descriptionMen:
      "Six months of structured suffering toward your best shape. Monthly elimination Zooms — show up or get cut. **100 spots max**. **+€10 per participant per month** (up to **€6,000**). Think you can coast? Cute.",
    descriptionWomen:
      "Six months to transform — not overnight, but for real. Monthly Zoom eliminations keep everyone honest and you accountable. **100 spots max**. **+€10 per participant per month** (up to **€6,000**). You've got this; now prove it to yourself.",
    duration_months: 6,
    duration_days: null,
  },
  {
    tier: "12-month",
    title: "12-Month Transformation Challenge",
    descriptionMen:
      "The year-long gauntlet. Twelve months of logging, AI coaching, and live Zoom cuts. **100 spots max**. **+€10 per participant per month** (up to **€12,000**). Only join if you're done being mediocre.",
    descriptionWomen:
      "The ultimate year-long journey — twelve months of daily wins, AI coaching, and live Zoom milestones. **100 spots max**. **+€10 per participant per month** (up to **€12,000**). This is your year. Own it.",
    duration_months: 12,
    duration_days: null,
  },
];

function slugForTier(tier: TransformationTierKey, gender: TransformationGenderSuffix): TransformationChallengeSlug {
  return `transformation-${tier}-${gender}` as TransformationChallengeSlug;
}

function genderColumnValue(gender: TransformationGenderSuffix): "male" | "female" {
  return gender === "men" ? "male" : "female";
}

type TransformationTemplate = Omit<TransformationTierTemplate, "descriptionMen" | "descriptionWomen"> & {
  slug: TransformationChallengeSlug;
  gender: "male" | "female";
  description: string;
};

const TRANSFORMATION_TEMPLATES: TransformationTemplate[] = TRANSFORMATION_TIER_TEMPLATES.flatMap(
  (tierTemplate) =>
    (["men", "women"] as const).map((genderSuffix) => ({
      ...tierTemplate,
      slug: slugForTier(tierTemplate.tier, genderSuffix),
      gender: genderColumnValue(genderSuffix),
      description:
        genderSuffix === "men" ? tierTemplate.descriptionMen : tierTemplate.descriptionWomen,
    }))
);

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
    gender: template.gender,
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

/** Upsert the eight transformation challenges so registration works without manual migration. */
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
          gender: template.gender,
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

export function mergeTransformationChallenges(
  dbChallenges: Challenge[],
  profileGender?: string | null
): Challenge[] {
  const bySlug = new Map<string, Challenge>();

  for (const catalog of getTransformationChallengeCatalog()) {
    bySlug.set(catalog.slug, catalog);
  }

  for (const row of dbChallenges) {
    const existing = bySlug.get(row.slug);
    bySlug.set(row.slug, existing ? { ...existing, ...row } : row);
  }

  const userGender =
    profileGender === "male" ? "male" : profileGender === "female" ? "female" : null;

  return TRANSFORMATION_CHALLENGE_SLUGS.filter((slug) => {
    const challenge = bySlug.get(slug);
    if (!challenge) return false;
    if (!userGender) return true;
    return challenge.gender === userGender;
  }).map((slug) => bySlug.get(slug)!);
}

export function getTransformationDurationLabel(challenge: Challenge): string {
  if (challenge.duration_days === 30) return "30 days";
  if (challenge.duration_days === 90) return "90 days";
  if (challenge.duration_months === 6) return "6 months";
  if (challenge.duration_months === 12) return "12 months";
  if (challenge.duration_days) return `${challenge.duration_days} days`;
  return `${challenge.duration_months} months`;
}
