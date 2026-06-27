"use client";

import { useMemo } from "react";
import Image from "next/image";
import { AI_COACH_AVATAR_SRC } from "@/components/ai-coach-avatar";
import { useCoachCopy } from "@/components/locale-provider";

export function CoachAlexNavLoading() {
  const coachCopy = useCoachCopy();
  const quip = useMemo(() => {
    const quips = coachCopy.navLoading.quips;
    return quips[Math.floor(Math.random() * quips.length)];
  }, [coachCopy.navLoading.quips]);

  return (
    <div
      className="flex min-h-[min(50vh,22rem)] flex-col items-center justify-center px-4 py-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="coach-alex-nav-loading__stage relative mx-auto mb-4 h-32 w-32 sm:h-36 sm:w-36">
        <div
          className="pointer-events-none absolute inset-0 z-[2] animate-spin rounded-full border-[3px] border-primary/25 border-t-primary sm:border-4"
          aria-hidden
        />
        <div className="coach-alex-nav-loading__avatar absolute inset-4 overflow-hidden rounded-full border-2 border-primary/30 shadow-lg shadow-primary/10">
          <Image
            src={AI_COACH_AVATAR_SRC}
            alt=""
            fill
            className="object-cover object-top"
            sizes="(min-width: 640px) 144px, 128px"
            priority
          />
        </div>
      </div>

      <div className="coach-alex-nav-loading__dots mb-6" aria-hidden>
        <span className="coach-alex-nav-loading__pulse-dot" />
        <span className="coach-alex-nav-loading__pulse-dot" />
        <span className="coach-alex-nav-loading__pulse-dot" />
      </div>

      <div className="max-w-sm text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {coachCopy.navLoading.coachName}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          &ldquo;{quip}&rdquo;
        </p>
      </div>
    </div>
  );
}
