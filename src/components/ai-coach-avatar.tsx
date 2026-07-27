"use client";

import Image from "next/image";
import { useTheme } from "@/components/theme-provider";
import type { AccentColor } from "@/lib/theme-colors";
import { cn } from "@/lib/utils";

/** Default / SSR-safe path (red brand). Prefer `getAiCoachAvatarSrc` when accent is known. */
export const AI_COACH_AVATAR_SRC = "/ai-coach/red.png";

export const AI_COACH_AVATAR_BY_ACCENT: Record<AccentColor, string> = {
  red: "/ai-coach/red.png",
  purple: "/ai-coach/purple.png",
  pink: "/ai-coach/pink.png",
  teal: "/ai-coach/teal.png",
  blue: "/ai-coach/blue.png",
  neon: "/ai-coach/neon.png",
  black: "/ai-coach/black.png",
  yellow: "/ai-coach/yellow.png",
};

export function getAiCoachAvatarSrc(accent: AccentColor = "red"): string {
  return AI_COACH_AVATAR_BY_ACCENT[accent] ?? AI_COACH_AVATAR_BY_ACCENT.red;
}

const SIZE_CLASSES = {
  xs: "h-8 w-8",
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-14 w-14",
  fab: "h-14 w-14",
} as const;

export function AiCoachAvatar({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const { accentColor } = useTheme();
  const src = getAiCoachAvatarSrc(accentColor);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full",
        SIZE_CLASSES[size],
        className
      )}
    >
      <Image
        key={src}
        src={src}
        alt="Coach Alex"
        fill
        className="object-cover object-top"
        sizes={`(max-width: 640px) 96px, 112px`}
        priority={size === "fab"}
      />
    </div>
  );
}
