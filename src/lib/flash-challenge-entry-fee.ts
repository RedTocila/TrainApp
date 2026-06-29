import type { ChallengeParticipant } from "@/lib/types";

export type FlashEntryAction = "join" | "confirm";

export function flashGroupSize(challenge: { group_size?: number }): number {
  return challenge.group_size && challenge.group_size > 0 ? challenge.group_size : 10;
}

/** First N seats can be reserved without paying until the first group is full. */
export function flashSeatIsFreeOnJoin(
  participantCountBeforeJoin: number,
  groupSize: number
): boolean {
  return participantCountBeforeJoin < groupSize;
}

/** Joiners after the first group must pay before they are added. */
export function flashRequiresPaymentOnJoin(
  participantCountBeforeJoin: number,
  groupSize: number
): boolean {
  return participantCountBeforeJoin >= groupSize;
}

export function flashFirstGroupIsFull(
  participantCount: number,
  groupSize: number
): boolean {
  return participantCount >= groupSize;
}

export function flashParticipantIndex(
  participant: Pick<ChallengeParticipant, "id" | "created_at">,
  participants: Pick<ChallengeParticipant, "id" | "created_at">[]
): number {
  const sorted = [...participants].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return sorted.findIndex((row) => row.id === participant.id);
}

export function flashParticipantIsInFirstGroup(
  participant: Pick<ChallengeParticipant, "id" | "created_at">,
  participants: Pick<ChallengeParticipant, "id" | "created_at">[],
  groupSize: number
): boolean {
  const index = flashParticipantIndex(participant, participants);
  return index >= 0 && index < groupSize;
}

/** First-group members pay once the group fills; everyone else pays on join. */
export function flashParticipantNeedsPayment(
  participant: Pick<ChallengeParticipant, "id" | "created_at" | "entry_fee_paid_at">,
  participants: Pick<ChallengeParticipant, "id" | "created_at" | "entry_fee_paid_at">[],
  groupSize: number
): boolean {
  if (participant.entry_fee_paid_at) return false;

  if (flashParticipantIsInFirstGroup(participant, participants, groupSize)) {
    return flashFirstGroupIsFull(participants.length, groupSize);
  }

  return true;
}

export function flashParticipantIsConfirmed(
  participant: Pick<ChallengeParticipant, "id" | "created_at" | "entry_fee_paid_at">,
  participants: Pick<ChallengeParticipant, "id" | "created_at" | "entry_fee_paid_at">[],
  groupSize: number
): boolean {
  return !flashParticipantNeedsPayment(participant, participants, groupSize);
}
