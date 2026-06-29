import type { WebSource } from "@/lib/ai/types";

export type { WebSource };

const MAX_SOURCES = 5;
const SNIPPET_MAX = 280;

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

function trimSnippet(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= SNIPPET_MAX) return cleaned;
  return `${cleaned.slice(0, SNIPPET_MAX - 1)}…`;
}

function dedupeSources(sources: WebSource[]): WebSource[] {
  const seen = new Set<string>();
  const unique: WebSource[] = [];
  for (const source of sources) {
    const key = normalizeUrl(source.url);
    if (!key.startsWith("http") || seen.has(key)) continue;
    seen.add(key);
    unique.push(source);
    if (unique.length >= MAX_SOURCES) break;
  }
  return unique;
}

async function searchTavily(query: string): Promise<WebSource[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: MAX_SOURCES,
      include_answer: false,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) return [];

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (data.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      title: r.title?.trim() || new URL(r.url!).hostname,
      url: r.url!,
      snippet: trimSnippet(r.content ?? ""),
      provider: "tavily" as const,
    }));
}

async function searchExa(query: string): Promise<WebSource[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      numResults: MAX_SOURCES,
      type: "auto",
      contents: { text: { maxCharacters: SNIPPET_MAX } },
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) return [];

  const data = (await response.json()) as {
    results?: Array<{ title?: string | null; url?: string; text?: string }>;
  };

  return (data.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      title: r.title?.trim() || new URL(r.url!).hostname,
      url: r.url!,
      snippet: trimSnippet(r.text ?? ""),
      provider: "exa" as const,
    }));
}

export function isWebSearchConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY || process.env.EXA_API_KEY);
}

/** Skip web search for very short or casual messages. */
export function shouldSearchWeb(message: string): boolean {
  if (!isWebSearchConfigured()) return false;

  const trimmed = message.trim();
  if (trimmed.length < 12) return false;
  if (/^(hi|hey|hello|yo|sup|thanks|thank you|ok|okay|bye|pershendetje|përshëndetje|faleminderit)\b/i.test(trimmed)) {
    return false;
  }

  // Explicit signals that fresh external facts would help
  const needsExternalFacts =
    /\b(latest|recent|new study|new research|studies show|research says|according to|evidence (for|that|on)|scientific(ally)?|look up|search for|find (me )?(a )?(link|article|source)|source for|cite|guidelines?|fda|who recommends?)\b/i.test(
      trimmed
    ) ||
    /\b(is .+ safe|side effects?|dosage|interact(s|ion)|banned substance|clinical trial)\b/i.test(
      trimmed
    ) ||
    /\b20(2[4-9]|[3-9]\d)\b/.test(trimmed);

  if (needsExternalFacts) return true;

  // Personal coaching — use profile + training knowledge, not the web
  const personalCoaching =
    /\b(my |me |mine|i should|i want|how (can|do|should) i|help me|for me|based on my)\b/i.test(
      trimmed
    ) ||
    /\b(workout|training split|exercise|macro|meal plan|recipe|motivation|consistent|recovery|sleep|form cue|program|rutina|stërvitje|ushqim|proteinë)\b/i.test(
      trimmed
    );

  if (personalCoaching) return false;

  // General coaching questions — no web needed by default
  return false;
}

export async function searchWebForCoach(query: string): Promise<WebSource[]> {
  if (!shouldSearchWeb(query)) return [];

  const fitnessQuery = `${query} fitness nutrition training`;

  const [tavily, exa] = await Promise.all([
    searchTavily(fitnessQuery).catch(() => [] as WebSource[]),
    searchExa(fitnessQuery).catch(() => [] as WebSource[]),
  ]);

  return dedupeSources([...tavily, ...exa]);
}

/** Direct web search without coach heuristics — for server-side enrichment. */
export async function searchWebQuery(query: string): Promise<WebSource[]> {
  if (!isWebSearchConfigured()) return [];

  const [tavily, exa] = await Promise.all([
    searchTavily(query).catch(() => [] as WebSource[]),
    searchExa(query).catch(() => [] as WebSource[]),
  ]);

  return dedupeSources([...tavily, ...exa]);
}

export function formatWebSourcesForPrompt(sources: WebSource[]): string {
  if (sources.length === 0) return "";

  const lines = sources.map(
    (s, i) =>
      `[${i + 1}] ${s.title}\nURL: ${s.url}\nSnippet: ${s.snippet || "(no preview)"}`
  );

  return `Web search results (use these for factual claims — only link to URLs listed here):
${lines.join("\n\n")}`;
}
