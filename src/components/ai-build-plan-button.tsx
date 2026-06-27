"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const hrefByType = {
  workout: "/dashboard/ai/plans/workout",
  nutrition: "/dashboard/ai/plans/nutrition",
} as const;

export function AiBuildPlanButton({
  type,
  className,
  iconOnly = false,
  size = "sm",
  variant = "secondary",
}: {
  type: keyof typeof hrefByType;
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "secondary" | "outline" | "ghost";
}) {
  const platform = usePlatformCopy();
  const label = platform.ai.buildPlan;

  return (
    <Link
      href={hrefByType[type]}
      aria-label={iconOnly ? label : undefined}
      className={cn(
        buttonVariants({
          variant,
          size: iconOnly ? "icon" : size,
        }),
        iconOnly && "h-9 w-9 shrink-0",
        !iconOnly && "shrink-0",
        className
      )}
    >
      <Sparkles className={cn("h-4 w-4", !iconOnly && "mr-1.5")} />
      {!iconOnly && label}
    </Link>
  );
}
