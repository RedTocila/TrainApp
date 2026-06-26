const COACH_READ_ME_ACK_KEY = "coach-read-me-ack-v1";

export function hasCoachReadMeAcknowledged(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COACH_READ_ME_ACK_KEY) === "1";
}

export function setCoachReadMeAcknowledged(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COACH_READ_ME_ACK_KEY, "1");
}
