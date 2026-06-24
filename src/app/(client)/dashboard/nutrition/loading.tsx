"use client";

import { NutritionSectionTabs } from "@/components/nutrition-section-tabs";

function SkeletonLine({ className }: { className?: string }) {
  return <div className={["animate-pulse rounded-md bg-secondary/50", className].filter(Boolean).join(" ")} />;
}

export default function NutritionLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <NutritionSectionTabs />

      <div className="space-y-3">
        <SkeletonLine className="h-8 w-44" />
        <SkeletonLine className="h-4 w-64" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <SkeletonLine className="h-5 w-40" />
            <SkeletonLine className="mt-3 h-4 w-56" />
            <SkeletonLine className="mt-2 h-4 w-44" />
            <SkeletonLine className="mt-4 h-8 w-28 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

