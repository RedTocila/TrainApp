"use client";

import { Radio, Users, Zap } from "lucide-react";
import type { ChallengeListCategory } from "@/lib/challenge-list-filters";
import { cn } from "@/lib/utils";

function CategoryTag({
  active,
  onClick,
  label,
  count,
  icon: Icon,
  activeClassName,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: typeof Radio;
  activeClassName: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex w-auto shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap",
        active
          ? activeClassName
          : "border-border bg-muted text-muted-foreground hover:border-primary/30 hover:text-foreground"
      )}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
      <span>{label}</span>
      <span
        className={cn(
          "shrink-0 rounded-full px-1 py-px text-[10px] leading-none tabular-nums",
          active ? "bg-black/15" : "bg-background/80"
        )}
      >
        {count}
      </span>
    </button>
  );
}

export function ChallengeCategoryFilterBar({
  category,
  counts,
  onChange,
  labels,
}: {
  category: ChallengeListCategory;
  counts: Record<ChallengeListCategory, number>;
  onChange: (category: ChallengeListCategory) => void;
  labels: {
    all: string;
    flash: string;
    men: string;
    women: string;
  };
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="tablist"
      aria-label="Challenge categories"
    >
      <CategoryTag
        active={category === "all"}
        onClick={() => onChange("all")}
        label={labels.all}
        count={counts.all}
        activeClassName="border-primary/30 bg-primary/10 text-primary"
      />
      <CategoryTag
        active={category === "flash"}
        onClick={() => onChange("flash")}
        label={labels.flash}
        count={counts.flash}
        icon={Zap}
        activeClassName="border-amber-500/30 bg-amber-500/10 text-amber-200"
      />
      <CategoryTag
        active={category === "men"}
        onClick={() => onChange("men")}
        label={labels.men}
        count={counts.men}
        icon={Users}
        activeClassName="border-blue-500/30 bg-blue-500/10 text-blue-300"
      />
      <CategoryTag
        active={category === "women"}
        onClick={() => onChange("women")}
        label={labels.women}
        count={counts.women}
        icon={Users}
        activeClassName="border-pink-500/30 bg-pink-500/10 text-pink-300"
      />
    </div>
  );
}
