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

export function extractYoutubeStartSeconds(url: string): number | null {
  const match = url.match(/[?&](?:t|start)=(\d+)/);
  if (!match?.[1]) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export function getYoutubeThumbnailUrl(url: string): string | null {
  const id = extractYoutubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function getYoutubeEmbedUrl(
  url: string,
  options?: { autoplay?: boolean; controls?: boolean }
): string | null {
  const id = extractYoutubeId(url);
  if (!id) return null;

  const start = extractYoutubeStartSeconds(url);

  const params = new URLSearchParams();
  if (start != null) params.set("start", String(start));
  if (options?.autoplay) {
    params.set("autoplay", "1");
    // Browsers block unmuted autoplay after async loads (e.g. fetching admin override).
    params.set("mute", "1");
  }
  if (options?.controls === false) {
    params.set("controls", "0");
  }
  params.set("playsinline", "1");
  params.set("rel", "0");
  params.set("modestbranding", "1");
  params.set("iv_load_policy", "3");

  const qs = params.toString();
  return `https://www.youtube.com/embed/${id}${qs ? `?${qs}` : ""}`;
}

export function isValidYoutubeUrl(url: string): boolean {
  return extractYoutubeId(url) !== null;
}
