const KEY_PREFIX = "progress-photo-read-me-ack-v1";

function storageKey(clientId: string): string {
  return `${KEY_PREFIX}:${clientId}`;
}

export function hasProgressPhotoReadMeAcknowledged(clientId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(storageKey(clientId)) === "1";
}

export function setProgressPhotoReadMeAcknowledged(clientId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(clientId), "1");
}
