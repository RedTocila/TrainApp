"use client";

import type { ReactNode } from "react";

export function ProgramsPageHeader({
  title,
  tabs,
  actions,
}: {
  title: string;
  tabs: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-black">{title}</h1>
        {actions ? (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        ) : null}
      </div>
      <div className="overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs}
      </div>
    </div>
  );
}
