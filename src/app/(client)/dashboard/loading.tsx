export default function Loading() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="h-8 w-48 rounded-lg bg-secondary" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 rounded-xl bg-secondary" />
        <div className="h-40 rounded-xl bg-secondary" />
      </div>
      <div className="h-64 rounded-xl bg-secondary" />
    </div>
  );
}
