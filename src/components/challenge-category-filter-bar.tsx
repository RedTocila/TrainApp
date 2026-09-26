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
          : "border-border/60 bg-secondary/50 text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
      )}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
      <span>{label}</span>
      <span
        className={cn(
          "shrink-0 rounded-full px-1 py-px text-[10px] leading-none tabular-nums",
          active ? "bg-black/15" : "bg-zinc-800/80 text-zinc-400"
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
        activeClassName="border-primary/25 bg-primary/12 text-primary/90"
      />
      <CategoryTag
        active={category === "flash"}
        onClick={() => onChange("flash")}
        label={labels.flash}
        count={counts.flash}
        icon={Zap}
        activeClassName="border-amber-500/25 bg-amber-500/12 text-amber-300/90"
      />
      <CategoryTag
        active={category === "men"}
        onClick={() => onChange("men")}
        label={labels.men}
        count={counts.men}
        icon={Users}
        activeClassName="border-sky-500/25 bg-sky-500/12 text-sky-300/90"
      />
      <CategoryTag
        active={category === "women"}
        onClick={() => onChange("women")}
        label={labels.women}
        count={counts.women}
        icon={Users}
        activeClassName="border-pink-500/25 bg-pink-500/12 text-pink-300/90"
      />
    </div>
  );
}
