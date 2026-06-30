export type ClientScorePeriod = "1d" | "7d" | "30d" | "90d" | "6m" | "1y" | "all";

export const CLIENT_SCORE_PERIODS: { id: ClientScorePeriod; label: string }[] = [
  { id: "1d", label: "Daily" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "6m", label: "6 months" },
  { id: "1y", label: "1 year" },
  { id: "all", label: "All" },
];

export function resolveClientScoreSince(
  period: ClientScorePeriod,
  clientCreatedAt: string
): string {
  if (period === "all") return clientCreatedAt;

  const now = new Date();
  let start: Date;

  switch (period) {
    case "1d":
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    case "7d":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "6m":
      start = new Date(now.getTime() - 183 * 24 * 60 * 60 * 1000);
      break;
    case "1y":
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      return clientCreatedAt;
  }

  const sinceIso = start.toISOString();
  return sinceIso < clientCreatedAt ? clientCreatedAt : sinceIso;
}
