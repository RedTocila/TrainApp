"use client";

import { Calendar, Hammer } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProgramEditTab = "build" | "schedule";

export function ProgramEditTabs({
  tab,
  onTabChange,
}: {
  tab: ProgramEditTab;
  onTabChange: (tab: ProgramEditTab) => void;
}) {
  const tabs = [
    { id: "build" as const, label: "Build", icon: Hammer },
    { id: "schedule" as const, label: "Schedule", icon: Calendar },
  ];

  return (
    <div className="flex gap-2 rounded-2xl border border-border bg-secondary/30 p-1">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onTabChange(id)}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
            tab === id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
