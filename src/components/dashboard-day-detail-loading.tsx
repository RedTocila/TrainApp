/** Lightweight route fallback — no full-screen Coach Alex loader. */
export function DashboardDayDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-2">
      <div className="h-9 w-24 animate-pulse rounded-md bg-muted/70" />
      <div className="h-72 animate-pulse rounded-2xl bg-muted/50" />
    </div>
  );
}
