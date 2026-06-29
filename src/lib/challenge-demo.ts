import type {
  Challenge,
  ChallengeAnnouncement,
  ChallengeBracketData,
  ChallengeParticipant,
  ChallengeParticipantStatus,
} from "@/lib/types";
import { sortBracketByPlatformScore } from "@/lib/challenge-participant-ranking";

export const DEMO_CHALLENGE_SLUG = "demo-summer-challenge";

const DEMO_CHALLENGE_ID = "00000000-0000-4000-8000-000000000002";
const DEMO_PARTICIPANT_COUNT = 100;
export { DEMO_PARTICIPANT_COUNT };
const DEMO_FINAL_ZOOM = "https://zoom.us/j/11111111111?pwd=demo-final";

const DEMO_FIRST_NAMES = [
  "Jordan",
  "Sam",
  "Taylor",
  "Casey",
  "Riley",
  "Avery",
  "Quinn",
  "Morgan",
  "Jamie",
  "Drew",
] as const;

const DEMO_LAST_NAMES = [
  "Lee",
  "Rivera",
  "Brooks",
  "Morgan",
  "Chen",
  "Kim",
  "Patel",
  "Diaz",
  "Ortiz",
  "Nguyen",
] as const;

function demoStartAt(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() - 10);
  return d;
}

function participantId(index: number): string {
  return `00000000-0000-4000-8001-${String(index + 1).padStart(12, "0")}`;
}

function demoParticipantName(index: number): string {
  const first = DEMO_FIRST_NAMES[index % DEMO_FIRST_NAMES.length]!;
  const last = DEMO_LAST_NAMES[Math.floor(index / DEMO_FIRST_NAMES.length) % DEMO_LAST_NAMES.length]!;
  return `${first} ${last}`;
}

const start = demoStartAt();
const judgmentDay = new Date(start);
judgmentDay.setMonth(judgmentDay.getMonth() + 3);

/** Shown when no challenges exist in the database yet (or alongside real challenges). */
export const DEMO_CHALLENGE: Challenge = {
  id: DEMO_CHALLENGE_ID,
  title: "Demo: 100-Person Transformation Challenge",
  slug: DEMO_CHALLENGE_SLUG,
  description: `## Preview the points leaderboard

This **demo challenge** shows how a **long transformation challenge** works over **3 months**:

1. **Log daily** — nutrition, workouts, and habits earn **0–100 points per day** (max ~3,000 over 30 days)
2. **Leaderboard** — everyone ranked by total points; no rounds or groups
3. **Judgment day** — organizer invites top scorers to a **live Zoom** call
4. **Winner** — organizer crowns **1 champion** for the **€1,000** prize pool

Create real challenges in **Admin → Challenges**.`,
  scheduled_at: start.toISOString(),
  duration_minutes: 60,
  duration_months: 3,
  duration_days: 30,
  max_participants: 100,
  is_transformation: true,
  is_flash: false,
  entry_fee_cents: 0,
  group_size: 10,
  final_zoom_url: DEMO_FINAL_ZOOM,
  champion_participant_id: participantId(0),
  prize_pool_cents_per_participant: 1000,
  round_1_zoom_at: null,
  round_2_zoom_at: null,
  round_3_zoom_at: judgmentDay.toISOString(),
  prize_paid_at: null,
  current_phase: 3,
  published: true,
  created_at: new Date().toISOString(),
};

const DEMO_ANNOUNCEMENT_ID = "00000000-0000-4000-8003-000000000001";

export const DEMO_CHALLENGE_ANNOUNCEMENTS: ChallengeAnnouncement[] = [
  {
    id: DEMO_ANNOUNCEMENT_ID,
    challenge_id: DEMO_CHALLENGE_ID,
    title: "Judgment day invites going out",
    body: `Hey everyone — **Red here.**

The **points leaderboard** is live. Top scorers will get a Zoom invite for **judgment day** — be ready to show your transformation on camera.

- Keep logging daily for maximum points
- Upload monthly progress photos (front, back, side)
- Judgment-day link appears on the challenge page once you're invited

Let's go.`,
    published: true,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

export function getDemoChallengeAnnouncements(): ChallengeAnnouncement[] {
  return DEMO_CHALLENGE_ANNOUNCEMENTS;
}

export function isDemoChallengeSlug(slug: string): boolean {
  return slug === DEMO_CHALLENGE_SLUG;
}

export function isDemoChallengeId(id: string): boolean {
  return id === DEMO_CHALLENGE_ID;
}

export function getDemoChallenges(): Challenge[] {
  return [DEMO_CHALLENGE];
}

export function getDemoChallengeBySlug(slug: string): Challenge | undefined {
  return slug === DEMO_CHALLENGE_SLUG ? DEMO_CHALLENGE : undefined;
}

function demoPointsForIndex(index: number): number {
  return Math.max(900, 2920 - index * 18 + (index % 7) * 3);
}

function buildParticipants(viewerUserId?: string | null): ChallengeParticipant[] {
  const now = new Date().toISOString();
  const viewerSlot = 14;
  const championId = DEMO_CHALLENGE.champion_participant_id!;
  const finalistIds = new Set(
    [1, 2, 3, 4, viewerSlot].map((index) => participantId(index))
  );

  return Array.from({ length: DEMO_PARTICIPANT_COUNT }, (_, index) => {
    const id = participantId(index);
    let status: ChallengeParticipantStatus = "active";

    if (id === championId) {
      status = "champion";
    } else if (finalistIds.has(id)) {
      status = "finalist";
    }

    return {
      id,
      challenge_id: DEMO_CHALLENGE_ID,
      user_id:
        viewerUserId && index === viewerSlot
          ? viewerUserId
          : `00000000-0000-4000-8099-${String(index + 1).padStart(12, "0")}`,
      display_name: viewerUserId && index === viewerSlot ? "You (demo)" : demoParticipantName(index),
      status,
      eliminated_round: null,
      challenge_points: demoPointsForIndex(index),
      created_at: now,
    };
  });
}

export function getDemoChallengeBracket(
  viewerUserId?: string | null
): ChallengeBracketData {
  const participants = buildParticipants(viewerUserId);
  const champion =
    participants.find((p) => p.id === DEMO_CHALLENGE.champion_participant_id) ?? null;

  const currentUserParticipantId = viewerUserId
    ? participants.find((p) => p.user_id === viewerUserId)?.id ?? participantId(14)
    : null;

  return sortBracketByPlatformScore({
    challenge: DEMO_CHALLENGE,
    participants,
    round1Groups: [],
    round2Groups: [],
    round3Group: null,
    champion,
    currentUserParticipantId,
    currentPhase: 3,
    groupStage: [],
    finalRound: null,
  });
}
