export default function Loading() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="h-8 w-64 rounded-lg bg-secondary" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-xl bg-secondary" />
        <div className="h-24 rounded-xl bg-secondary" />
        <div className="h-24 rounded-xl bg-secondary" />
      </div>
      <div className="h-48 rounded-xl bg-secondary" />
    </div>
  );
}
