const COACH_READ_ME_ACK_KEY = "coach-read-me-ack-v2";
const LEGACY_KEY = "coach-read-me-ack-v1";

export function hasCoachReadMeAcknowledged(): boolean {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(COACH_READ_ME_ACK_KEY) === "1") return true;
  if (localStorage.getItem(LEGACY_KEY) === "1") {
    localStorage.setItem(COACH_READ_ME_ACK_KEY, "1");
    return true;
  }
  return false;
}

export function setCoachReadMeAcknowledged(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COACH_READ_ME_ACK_KEY, "1");
}
