import { unstable_cache } from "next/cache";

/** Fallback when the rate API is unavailable (approx. market rate). */
const FALLBACK_ALL_PER_EUR = 94.36;

async function fetchLiveAllPerEur(): Promise<number> {
  const response = await fetch("https://open.er-api.com/v6/latest/EUR", {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Exchange rate request failed (${response.status})`);
  }

  const data = (await response.json()) as { result?: string; rates?: { ALL?: number } };
  if (data.result !== "success") {
    throw new Error("Exchange rate API returned an error");
  }

  const rate = data.rates?.ALL;

  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid ALL exchange rate");
  }

  return rate;
}

function resolveFallbackAllPerEur(): number {
  const fromEnv = process.env.EXCHANGE_RATE_ALL_PER_EUR;
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return FALLBACK_ALL_PER_EUR;
}

export async function getAllPerEur(): Promise<number> {
  try {
    return await fetchLiveAllPerEur();
  } catch {
    return resolveFallbackAllPerEur();
  }
}

/** Cached server-side rate (refreshed hourly). */
export const getCachedAllPerEur = unstable_cache(
  async () => getAllPerEur(),
  ["all-per-eur"],
  { revalidate: 3600, tags: ["exchange-rate"] }
);
