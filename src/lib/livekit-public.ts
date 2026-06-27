/** Client-safe LiveKit URL (NEXT_PUBLIC only). */
export function getLivekitPublicUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim();
  return url || null;
}
