import { addDays, format, startOfDay } from "date-fns";

/** Days of calendar/enrichment history loaded with the dashboard. */
export const DASHBOARD_LOOKBACK_DAYS = 14;
/** Days of upcoming calendar loaded with the dashboard. */
export const DASHBOARD_LOOKAHEAD_DAYS = 14;

export function dashboardEnrichmentRange(
  today = new Date(),
  accountCreatedAt?: string | null
): { from: string; to: string } {
  const windowFrom = format(addDays(today, -DASHBOARD_LOOKBACK_DAYS), "yyyy-MM-dd");
  const accountFrom = accountCreatedAt
    ? format(startOfDay(new Date(accountCreatedAt)), "yyyy-MM-dd")
    : null;
  const from =
    accountFrom && accountFrom > windowFrom ? accountFrom : windowFrom;

  return {
    from,
    to: format(addDays(today, DASHBOARD_LOOKAHEAD_DAYS), "yyyy-MM-dd"),
  };
}
