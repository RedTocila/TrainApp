import "server-only";

export function getLivekitUrl(): string | null {
  return (
    process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() ||
    process.env.LIVEKIT_URL?.trim() ||
    null
  );
}

export function getLivekitApiKey(): string | null {
  return process.env.LIVEKIT_API_KEY?.trim() || null;
}

export function getLivekitApiSecret(): string | null {
  return process.env.LIVEKIT_API_SECRET?.trim() || null;
}

export function isLivekitConfigured(): boolean {
  return Boolean(getLivekitUrl() && getLivekitApiKey() && getLivekitApiSecret());
}
