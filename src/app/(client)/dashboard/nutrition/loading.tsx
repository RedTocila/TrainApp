"use client";

function SkeletonLine({ className }: { className?: string }) {
  return <div className={["animate-pulse rounded-md bg-secondary/50", className].filter(Boolean).join(" ")} />;
}

export default function NutritionLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <SkeletonLine className="h-7 w-28" />
        <SkeletonLine className="h-9 w-24 rounded-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4">
            <SkeletonLine className="h-5 w-40" />
            <SkeletonLine className="mt-3 h-4 w-56" />
            <SkeletonLine className="mt-4 h-8 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
