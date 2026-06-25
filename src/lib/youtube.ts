export function extractYoutubeId(url: string): string | null {
  if (!url.trim()) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function getYoutubeEmbedUrl(url: string): string | null {
  const id = extractYoutubeId(url);
  if (!id) return null;

  const startMatch = url.match(/[?&](?:t|start)=(\d+)/);
  const start = startMatch ? startMatch[1] : null;

  const params = new URLSearchParams();
  if (start) params.set("start", start);

  const qs = params.toString();
  return `https://www.youtube.com/embed/${id}${qs ? `?${qs}` : ""}`;
}

export function isValidYoutubeUrl(url: string): boolean {
  return extractYoutubeId(url) !== null;
}
