import { Award, Crown, Medal, Sparkles, Star } from "lucide-react";
import type { AmbassadorTierId } from "@/lib/referral-rewards";
import { cn } from "@/lib/utils";

const TIER_STYLES: Record<
  AmbassadorTierId,
  { icon: typeof Medal; className: string }
> = {
  bronze: {
    icon: Medal,
    className: "border-amber-700/40 bg-amber-900/20 text-amber-300",
  },
  silver: {
    icon: Award,
    className: "border-slate-400/40 bg-slate-500/15 text-slate-200",
  },
  gold: {
    icon: Star,
    className: "border-yellow-500/40 bg-yellow-500/15 text-yellow-200",
  },
  elite: {
    icon: Crown,
    className: "border-primary/40 bg-primary/15 text-primary",
  },
};

export function AmbassadorBadge({
  tier,
  label,
  className,
  size = "md",
}: {
  tier: AmbassadorTierId;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const style = TIER_STYLES[tier];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold",
        style.className,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        className
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {label}
      {tier === "elite" && <Sparkles className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />}
    </span>
  );
}
