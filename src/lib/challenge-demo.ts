import { groupScheduledAt } from "@/lib/challenge-utils";
import type {
  Challenge,
  ChallengeAnnouncement,
  ChallengeBracketData,
  ChallengeBracketGroup,
  ChallengeBracketParticipant,
  ChallengeMemberOutcome,
  ChallengeParticipant,
  ChallengeParticipantStatus,
} from "@/lib/types";

export const DEMO_CHALLENGE_SLUG = "demo-summer-challenge";

const DEMO_CHALLENGE_ID = "00000000-0000-4000-8000-000000000002";
const DEMO_GROUP_COUNT = 10;
const DEMO_GROUP_SIZE = 10;
const DEMO_PARTICIPANT_COUNT = DEMO_GROUP_COUNT * DEMO_GROUP_SIZE;
export { DEMO_PARTICIPANT_COUNT };
const DEMO_ZOOM = "https://zoom.us/j/00000000000?pwd=demo";
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

function groupId(round: number, index: number): string {
  return `00000000-0000-4000-800${round}-${String(index + 1).padStart(12, "0")}`;
}

function demoParticipantName(index: number): string {
  const first = DEMO_FIRST_NAMES[index % DEMO_FIRST_NAMES.length]!;
  const last = DEMO_LAST_NAMES[Math.floor(index / DEMO_FIRST_NAMES.length) % DEMO_LAST_NAMES.length]!;
  return `${first} ${last}`;
}

const start = demoStartAt();
const round1Base = new Date(start);
round1Base.setMonth(round1Base.getMonth() + 1);
const round2Base = new Date(start);
round2Base.setMonth(round2Base.getMonth() + 2);
const round3Base = new Date(start);
round3Base.setMonth(round3Base.getMonth() + 3);

/** Shown when no challenges exist in the database yet (or alongside real challenges). */
export const DEMO_CHALLENGE: Challenge = {
  id: DEMO_CHALLENGE_ID,
  title: "Demo: 100-Person Summer Challenge",
  slug: DEMO_CHALLENGE_SLUG,
  description: `## Preview the tournament

This **demo challenge** shows the full elimination flow over **3 months** (you can set 1–24 months on real challenges):

1. **Round 1** — 100 entrants in 10 Zoom groups of 10. Eliminate 5 per group → **50 advance**
2. **Round 2** — Survivors regrouped into 5 groups of 10. Pick **1 winner per group** → **5 finalists**
3. **Champion final** — Live vote → **1 champion** wins the **€1,000** prize pool

Log honestly all month. AI weekly reports help coaches prepare, but **Zoom verifies real transformation**.

Create real challenges in **Admin → Challenges**.`,
  scheduled_at: start.toISOString(),
  duration_minutes: 60,
  duration_months: 3,
  group_size: DEMO_GROUP_SIZE,
  final_zoom_url: DEMO_FINAL_ZOOM,
  champion_participant_id: participantId(1),
  prize_pool_cents_per_participant: 1000,
  round_1_zoom_at: round1Base.toISOString(),
  round_2_zoom_at: round2Base.toISOString(),
  round_3_zoom_at: round3Base.toISOString(),
  prize_paid_at: null,
  current_phase: 4,
  published: true,
  created_at: new Date().toISOString(),
};

const DEMO_ANNOUNCEMENT_ID = "00000000-0000-4000-8003-000000000001";

export const DEMO_CHALLENGE_ANNOUNCEMENTS: ChallengeAnnouncement[] = [
  {
    id: DEMO_ANNOUNCEMENT_ID,
    challenge_id: DEMO_CHALLENGE_ID,
    title: "Round 1 Zoom groups are live",
    body: `Hey everyone — **Red here.**

Your **Group 2** slot is confirmed. Join on camera this Saturday and be ready to show your transformation progress.

- Check the challenge page for your **Zoom link**
- Have progress photos ready (front + side)
- Round 1 eliminates 5 per group — **5 advance**

Questions? Reply in the community chat. Let's go.`,
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

function buildParticipants(viewerUserId?: string | null): ChallengeParticipant[] {
  const now = new Date().toISOString();
  const viewerSlot = 14;
  const championId = DEMO_CHALLENGE.champion_participant_id!;
  const finalistIds = new Set(
    Array.from({ length: DEMO_GROUP_COUNT / 2 }, (_, i) => participantId(i * DEMO_GROUP_SIZE + 1))
  );

  return Array.from({ length: DEMO_PARTICIPANT_COUNT }, (_, index) => {
    const id = participantId(index);
    let status: ChallengeParticipantStatus = "active";
    let eliminated_round: 1 | 2 | 3 | null = null;

    if (id === championId) {
      status = "champion";
    } else if (finalistIds.has(id)) {
      status = "finalist";
    } else if (index % DEMO_GROUP_SIZE >= 5) {
      status = "eliminated";
      eliminated_round = 1;
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
      eliminated_round,
      created_at: now,
    };
  });
}

function toBracketParticipant(
  p: ChallengeParticipant,
  opts: {
    outcome: ChallengeMemberOutcome;
    groupId: string;
    groupNumber: number;
    round: 1 | 2 | 3;
    winnerId?: string | null;
  }
): ChallengeBracketParticipant {
  const championId = DEMO_CHALLENGE.champion_participant_id!;
  return {
    ...p,
    outcome: opts.outcome,
    is_champion: p.id === championId,
    is_group_winner: opts.outcome === "group_winner" || opts.outcome === "champion",
    group_id: opts.groupId,
    group_number: opts.groupNumber,
    round: opts.round,
  };
}

function buildRound1Groups(participants: ChallengeParticipant[]): ChallengeBracketGroup[] {
  return Array.from({ length: DEMO_GROUP_COUNT }, (_, groupIndex) => {
    const slice = participants.slice(
      groupIndex * DEMO_GROUP_SIZE,
      groupIndex * DEMO_GROUP_SIZE + DEMO_GROUP_SIZE
    );
    const gid = groupId(1, groupIndex);
    const scheduledAt = groupScheduledAt(DEMO_CHALLENGE.round_1_zoom_at, groupIndex);

    const members = slice.map((p, i) =>
      toBracketParticipant(p, {
        outcome: i < 5 ? "advanced" : "eliminated",
        groupId: gid,
        groupNumber: groupIndex + 1,
        round: 1,
      })
    );

    return {
      id: gid,
      challenge_id: DEMO_CHALLENGE_ID,
      round: 1,
      group_number: groupIndex + 1,
      zoom_url: DEMO_ZOOM,
      scheduled_at: scheduledAt,
      winner_participant_id: null,
      created_at: new Date().toISOString(),
      members,
      winner: null,
    };
  });
}

function buildRound2Groups(participants: ChallengeParticipant[]): ChallengeBracketGroup[] {
  const advanced = participants.filter((p) => p.status === "active" || p.status === "finalist" || p.status === "champion");
  const r2GroupCount = DEMO_GROUP_COUNT / 2;

  return Array.from({ length: r2GroupCount }, (_, groupIndex) => {
    const slice = advanced.slice(
      groupIndex * DEMO_GROUP_SIZE,
      groupIndex * DEMO_GROUP_SIZE + DEMO_GROUP_SIZE
    );
    const gid = groupId(2, groupIndex);
    const winnerId = slice[0]?.id ?? null;
    const scheduledAt = groupScheduledAt(DEMO_CHALLENGE.round_2_zoom_at, groupIndex);

    const members = slice.map((p) =>
      toBracketParticipant(p, {
        outcome: p.id === winnerId ? "group_winner" : "eliminated",
        groupId: gid,
        groupNumber: groupIndex + 1,
        round: 2,
        winnerId,
      })
    );

    const winner = members.find((m) => m.id === winnerId) ?? null;

    return {
      id: gid,
      challenge_id: DEMO_CHALLENGE_ID,
      round: 2,
      group_number: groupIndex + 1,
      zoom_url: DEMO_ZOOM,
      scheduled_at: scheduledAt,
      winner_participant_id: winnerId,
      created_at: new Date().toISOString(),
      members,
      winner,
    };
  });
}

function buildRound3Group(participants: ChallengeParticipant[]): ChallengeBracketGroup {
  const championId = DEMO_CHALLENGE.champion_participant_id!;
  const gid = groupId(3, 0);
  const finalistIds = Array.from({ length: DEMO_GROUP_COUNT / 2 }, (_, i) =>
    participantId(i * DEMO_GROUP_SIZE + 1)
  );

  const members = finalistIds
    .map((id) => participants.find((p) => p.id === id))
    .filter((p): p is ChallengeParticipant => !!p)
    .map((p) =>
      toBracketParticipant(p, {
        outcome: p.id === championId ? "champion" : "eliminated",
        groupId: gid,
        groupNumber: 1,
        round: 3,
        winnerId: championId,
      })
    );

  const winner = members.find((m) => m.id === championId) ?? null;

  return {
    id: gid,
    challenge_id: DEMO_CHALLENGE_ID,
    round: 3,
    group_number: 1,
    zoom_url: DEMO_FINAL_ZOOM,
    scheduled_at: DEMO_CHALLENGE.round_3_zoom_at,
    winner_participant_id: championId,
    created_at: new Date().toISOString(),
    members,
    winner,
  };
}

export function getDemoChallengeBracket(
  viewerUserId?: string | null
): ChallengeBracketData {
  const participants = buildParticipants(viewerUserId);
  const round1Groups = buildRound1Groups(participants);
  const round2Groups = buildRound2Groups(participants);
  const round3Group = buildRound3Group(participants);
  const champion =
    participants.find((p) => p.id === DEMO_CHALLENGE.champion_participant_id) ?? null;

  const currentUserParticipantId = viewerUserId
    ? participants.find((p) => p.user_id === viewerUserId)?.id ?? participantId(14)
    : null;

  return {
    challenge: DEMO_CHALLENGE,
    participants,
    round1Groups,
    round2Groups,
    round3Group,
    champion,
    currentUserParticipantId,
    currentPhase: 4,
    groupStage: round1Groups,
    finalRound: round3Group,
  };
}
