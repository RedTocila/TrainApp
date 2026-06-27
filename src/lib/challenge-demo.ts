import type {
  Challenge,
  ChallengeBracketData,
  ChallengeBracketGroup,
  ChallengeBracketParticipant,
  ChallengeParticipant,
} from "@/lib/types";

export const DEMO_CHALLENGE_SLUG = "demo-summer-challenge";

const DEMO_CHALLENGE_ID = "00000000-0000-4000-8000-000000000002";
const DEMO_GROUP_COUNT = 10;
const DEMO_GROUP_SIZE = 10;
const DEMO_PARTICIPANT_COUNT = DEMO_GROUP_COUNT * DEMO_GROUP_SIZE;
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

function demoScheduledAt(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - 10);
  return d.toISOString();
}

function participantId(index: number): string {
  return `00000000-0000-4000-8001-${String(index + 1).padStart(12, "0")}`;
}

function groupId(index: number): string {
  return `00000000-0000-4000-8002-${String(index + 1).padStart(12, "0")}`;
}

function demoParticipantName(index: number): string {
  const first = DEMO_FIRST_NAMES[index % DEMO_FIRST_NAMES.length]!;
  const last = DEMO_LAST_NAMES[Math.floor(index / DEMO_FIRST_NAMES.length) % DEMO_LAST_NAMES.length]!;
  return `${first} ${last}`;
}

/** Shown when no challenges exist in the database yet (or alongside real challenges). */
export const DEMO_CHALLENGE: Challenge = {
  id: DEMO_CHALLENGE_ID,
  title: "Demo: 100-Person Summer Challenge",
  slug: DEMO_CHALLENGE_SLUG,
  description: `## Preview the tournament bracket

This is a **demo challenge** showing how large community events work in RUTINA.

Winners are picked on **live Zoom calls** based on who **transformed the most** — not who logged the most checkmarks. Use the platform honestly throughout; the video calls are where the coach compares real results.

### How it works
1. **Register** and track workouts, meals, and habits accurately
2. **Group stage** — **10 Zoom groups** of **10**; coach picks whoever transformed the most in each call
3. **Final round** — group winners meet on one final Zoom call
4. **Champion** — crowned for the best overall transformation

### This demo includes
- **100 participants** in **10 groups** (expand each group to browse)
- Group winners and a crowned champion on the bracket
- Sample **Join Zoom** buttons

Create real challenges in **Admin → Challenges**.`,
  scheduled_at: demoScheduledAt(),
  duration_minutes: 120,
  group_size: DEMO_GROUP_SIZE,
  final_zoom_url: DEMO_FINAL_ZOOM,
  champion_participant_id: participantId(1),
  published: true,
  created_at: new Date().toISOString(),
};

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

  return Array.from({ length: DEMO_PARTICIPANT_COUNT }, (_, index) => ({
    id: participantId(index),
    challenge_id: DEMO_CHALLENGE_ID,
    user_id:
      viewerUserId && index === viewerSlot
        ? viewerUserId
        : `00000000-0000-4000-8099-${String(index + 1).padStart(12, "0")}`,
    display_name: viewerUserId && index === viewerSlot ? "You (demo)" : demoParticipantName(index),
    created_at: now,
  }));
}

function toBracketParticipant(
  p: ChallengeParticipant,
  opts: {
    championId: string;
    winnerId?: string | null;
    groupId?: string | null;
    groupNumber?: number | null;
    round?: 1 | 2 | null;
  }
): ChallengeBracketParticipant {
  return {
    ...p,
    is_champion: p.id === opts.championId,
    is_group_winner: !!opts.winnerId && p.id === opts.winnerId,
    group_id: opts.groupId ?? null,
    group_number: opts.groupNumber ?? null,
    round: opts.round ?? null,
  };
}

function buildGroupStage(participants: ChallengeParticipant[]): ChallengeBracketGroup[] {
  const championId = DEMO_CHALLENGE.champion_participant_id!;

  return Array.from({ length: DEMO_GROUP_COUNT }, (_, groupIndex) => {
    const slice = participants.slice(
      groupIndex * DEMO_GROUP_SIZE,
      groupIndex * DEMO_GROUP_SIZE + DEMO_GROUP_SIZE
    );
    const gid = groupId(groupIndex);
    const winnerId = participantId(groupIndex * DEMO_GROUP_SIZE + 1);

    const members = slice.map((p) =>
      toBracketParticipant(p, {
        championId,
        winnerId,
        groupId: gid,
        groupNumber: groupIndex + 1,
        round: 1,
      })
    );

    const winner = members.find((m) => m.id === winnerId) ?? null;

    return {
      id: gid,
      challenge_id: DEMO_CHALLENGE_ID,
      round: 1 as const,
      group_number: groupIndex + 1,
      zoom_url: DEMO_ZOOM,
      winner_participant_id: winnerId,
      created_at: new Date().toISOString(),
      members,
      winner,
    };
  });
}

function buildFinalRound(
  participants: ChallengeParticipant[],
  groupStage: ChallengeBracketGroup[]
): ChallengeBracketGroup {
  const championId = DEMO_CHALLENGE.champion_participant_id!;
  const gid = groupId(DEMO_GROUP_COUNT);
  const finalistIds = groupStage
    .map((g) => g.winner_participant_id)
    .filter((id): id is string => !!id);

  const members = finalistIds
    .map((id) => participants.find((p) => p.id === id))
    .filter((p): p is ChallengeParticipant => !!p)
    .map((p) =>
      toBracketParticipant(p, {
        championId,
        winnerId: championId,
        groupId: gid,
        groupNumber: 1,
        round: 2,
      })
    );

  const winner = members.find((m) => m.id === championId) ?? null;

  return {
    id: gid,
    challenge_id: DEMO_CHALLENGE_ID,
    round: 2,
    group_number: 1,
    zoom_url: DEMO_FINAL_ZOOM,
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
  const groupStage = buildGroupStage(participants);
  const finalRound = buildFinalRound(participants, groupStage);
  const champion =
    participants.find((p) => p.id === DEMO_CHALLENGE.champion_participant_id) ?? null;

  const currentUserParticipantId = viewerUserId
    ? participants.find((p) => p.user_id === viewerUserId)?.id ?? participantId(14)
    : null;

  return {
    challenge: DEMO_CHALLENGE,
    participants,
    groupStage,
    finalRound,
    champion,
    currentUserParticipantId,
  };
}
