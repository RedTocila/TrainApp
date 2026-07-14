"use client";

import { useState, type ReactNode } from "react";
import {
  Dumbbell,
  Flame,
  Medal,
  Timer,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ChallengeMediaIconKey } from "@/lib/challenge-card-covers";
import { cn } from "@/lib/utils";

const ICONS: Record<ChallengeMediaIconKey, LucideIcon> = {
  flame: Flame,
  trophy: Trophy,
  medal: Medal,
  dumbbell: Dumbbell,
  timer: Timer,
  zap: Zap,
};

/**
 * Dedicated image band for challenge cards / heroes.
 * Put art files under `/public/challenges/cards/` — paths come from `getChallengeCardVisual`.
 * When the file is missing, the gradient + icon placeholder stays visible.
 */
export function ChallengeMediaFrame({
  coverImage,
  gradient,
  icon,
  className,
  children,
  size = "card",
}: {
  coverImage: string | null;
  gradient: string;
  icon: ChallengeMediaIconKey;
  className?: string;
  children?: ReactNode;
  size?: "card" | "hero";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(coverImage) && !imageFailed;
  const Icon = ICONS[icon] ?? Trophy;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden",
        size === "card"
          ? "aspect-[16/10] w-full"
          : "aspect-[21/9] w-full min-h-[160px] sm:min-h-[200px]",
        className
      )}
    >
      <div
        className={cn("absolute inset-0 bg-gradient-to-br", gradient)}
        aria-hidden
      />

      {!showImage ? (
        <div
          className="absolute inset-0 flex items-center justify-center text-white/85"
          aria-hidden
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-black/25 backdrop-blur-sm sm:h-20 sm:w-20">
            <Icon className="h-8 w-8 sm:h-10 sm:w-10" />
          </span>
        </div>
      ) : null}

      {coverImage && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}

      {showImage ? (
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent"
          aria-hidden
        />
      ) : (
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.18),transparent_55%)]"
          aria-hidden
        />
      )}

      {children ? <div className="absolute inset-0 z-10">{children}</div> : null}
    </div>
  );
}
