"use client";

import type { ReactNode } from "react";
import { WorkoutSectionTabs } from "@/components/workout-section-tabs";

export function WorkoutPageHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
      <h1 className="shrink-0 text-lg font-black">{title}</h1>
      <div className="flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[420px]:flex-none">
          <WorkoutSectionTabs />
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
