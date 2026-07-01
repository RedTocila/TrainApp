const EXERCISEDB_GIF_ID_PATTERN =
  /(?:static\.exercisedb\.dev|cdn\.exercisedb\.dev|assets\.exercisedb\.dev)\/media\/([a-zA-Z0-9]+)\.gif/i;

export function extractExerciseGifId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9]+$/.test(trimmed)) return trimmed;

  const match = trimmed.match(EXERCISEDB_GIF_ID_PATTERN);
  return match?.[1] ?? null;
}

/** Same-origin proxy for ExerciseDB GIFs (CDN blocks direct browser access). */
export function toExerciseGifProxyUrl(
  urlOrId: string | null | undefined
): string | null {
  if (!urlOrId?.trim()) return null;

  const id = extractExerciseGifId(urlOrId);
  if (!id) return urlOrId.trim();

  return `/api/exercise-gif/${id}`;
}

export function pickExerciseDbGifUrl(exercise: {
  gifUrl?: string | null;
  gifUrls?: Record<string, string | undefined> | null;
}): string | null {
  const gifs = exercise.gifUrls;
  if (gifs && typeof gifs === "object") {
    return (
      gifs["1080p"] ??
      gifs["720p"] ??
      gifs["480p"] ??
      gifs["360p"] ??
      gifs["180p"] ??
      null
    );
  }

  return exercise.gifUrl?.trim() || null;
}
