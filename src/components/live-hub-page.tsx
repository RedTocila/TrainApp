"use client";

import { useMemo, useState } from "react";
import { Clock, Radio, Users, Video } from "lucide-react";
import { ClassesCatalog } from "@/components/classes-catalog";
import { ChallengesCatalog } from "@/components/challenges-catalog";
import { usePlatformCopy } from "@/components/locale-provider";
import { getChallengeStatus } from "@/lib/challenge-utils";
import type { Challenge, FitnessClass } from "@/lib/types";
import { cn } from "@/lib/utils";

type LiveTab = "classes" | "challenges";

export function LiveHubPage({
  classes,
  challenges,
  memberships = {},
  requiresUpgrade = false,
}: {
  classes: FitnessClass[];
  challenges: Challenge[];
  memberships?: Record<string, import("@/lib/actions/challenges").ChallengeCardMembership>;
  requiresUpgrade?: boolean;
}) {
  const platform = usePlatformCopy();
  const [tab, setTab] = useState<LiveTab>("challenges");

  const liveChallengeCount = useMemo(
    () => challenges.filter((c) => getChallengeStatus(c) === "live").length,
    [challenges]
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6">
      <header>
        <nav
          className="dashboard-instant-nav mb-3 flex rounded-full bg-secondary/50 p-1"
          role="tablist"
          aria-label="Live sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "challenges"}
            onClick={() => setTab("challenges")}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-3 text-xs font-semibold transition-all touch-manipulation select-none [-webkit-tap-highlight-color:transparent]",
              tab === "challenges"
                ? "bg-violet-500/20 text-violet-400 shadow-sm"
                : "text-muted-foreground active:opacity-80 [@media(hover:hover)]:hover:text-foreground"
            )}
          >
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Challenges</span>
            {liveChallengeCount > 0 && (
              <span className="absolute right-2 top-1.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "classes"}
            onClick={() => setTab("classes")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-3 text-xs font-semibold transition-all touch-manipulation select-none [-webkit-tap-highlight-color:transparent]",
              tab === "classes"
                ? "bg-primary/20 text-primary shadow-sm"
                : "text-muted-foreground active:opacity-80 [@media(hover:hover)]:hover:text-foreground"
            )}
          >
            <Video className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Live Classes</span>
          </button>
        </nav>
      </header>

      <div
        role="status"
        className={cn(
          "flex items-start gap-3 rounded-2xl border px-4 py-3.5",
          tab === "challenges"
            ? "border-violet-500/30 bg-gradient-to-r from-violet-500/15 via-violet-500/5 to-transparent"
            : "border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent"
        )}
      >
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            tab === "challenges"
              ? "bg-violet-500/15 text-violet-300"
              : "bg-primary/15 text-primary"
          )}
        >
          <Clock className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-black uppercase tracking-wide",
              tab === "challenges" ? "text-violet-300" : "text-primary"
            )}
          >
            {platform.classes.comingSoon}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {platform.classes.comingSoonBanner}
          </p>
        </div>
      </div>

      <div role="tabpanel">
        {tab === "challenges" ? (
          <div className="space-y-4">
            {liveChallengeCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300">
                <Radio className="h-3.5 w-3.5" />
                {liveChallengeCount} live now
              </span>
            )}
            <ChallengesCatalog
              challenges={challenges}
              memberships={memberships}
              requiresUpgrade={requiresUpgrade}
            />
          </div>
        ) : (
          <ClassesCatalog classes={classes} requiresUpgrade={requiresUpgrade} />
        )}
      </div>
    </div>
  );
}
