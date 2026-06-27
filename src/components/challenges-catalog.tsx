"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ArrowRight, Calendar, Clock, Radio, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  canJoinChallenge,
  challengeExcerpt,
  getChallengeStatus,
  partitionChallenges,
} from "@/lib/challenge-utils";
import type { Challenge } from "@/lib/types";
import { DEMO_CHALLENGE_SLUG } from "@/lib/challenge-demo";
import { cn } from "@/lib/utils";

function ChallengeStatusBadge({ challenge }: { challenge: Challenge }) {
  const status = getChallengeStatus(challenge);
  const styles = {
    upcoming: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    live: "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse",
    ended: "bg-muted text-muted-foreground border-border",
  };
  const labels = {
    upcoming: "Upcoming",
    live: "Live now",
    ended: "Ended",
  };

  return (
    <Badge variant="outline" className={cn("border text-xs", styles[status])}>
      {status === "live" && <Radio className="mr-1 h-3 w-3" />}
      {labels[status]}
    </Badge>
  );
}

function LiveChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <Link href={`/dashboard/challenges/${challenge.slug}`} className="group block">
      <motion.article
        layout
        className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-card shadow-2xl shadow-violet-500/10 transition-shadow group-hover:shadow-violet-500/25"
        whileHover={{ y: -4 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-800 opacity-90" />
        <div className="relative flex min-h-[200px] flex-col justify-between p-6 sm:min-h-[220px]">
          <div className="space-y-3">
            <Badge className="border-violet-400/40 bg-violet-500/25 text-violet-100">
              <Radio className="mr-1 h-3 w-3 animate-pulse" />
              {challenge.slug === DEMO_CHALLENGE_SLUG ? "Demo · Live" : "Community live"}
            </Badge>
            <h3 className="text-xl font-black text-white sm:text-2xl">{challenge.title}</h3>
            <p className="max-w-xl text-sm text-white/80">{challengeExcerpt(challenge.description)}</p>
          </div>
          <span className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
            View bracket
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </motion.article>
    </Link>
  );
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const status = getChallengeStatus(challenge);
  const joinable = canJoinChallenge(challenge);

  return (
    <Link href={`/dashboard/challenges/${challenge.slug}`} className="group block h-full">
      <motion.article
        layout
        className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5"
        whileHover={{ y: -3 }}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ChallengeStatusBadge challenge={challenge} />
          {joinable && status !== "ended" && (
            <Badge variant="secondary" className="text-xs">
              <Users className="mr-1 h-3 w-3" />
              Open
            </Badge>
          )}
        </div>
        <h3 className="font-bold leading-snug group-hover:text-primary">{challenge.title}</h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
          {challengeExcerpt(challenge.description)}
        </p>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(challenge.scheduled_at), "MMM d · h:mm a")}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {challenge.duration_minutes} min
          </span>
        </div>
      </motion.article>
    </Link>
  );
}

export function ChallengesCatalog({ challenges }: { challenges: Challenge[] }) {
  const { live, upcoming, ended } = useMemo(() => partitionChallenges(challenges), [challenges]);
  const hasContent = live.length + upcoming.length + ended.length > 0;

  if (!hasContent) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No community challenges scheduled yet. Check back soon.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {live.length > 0 && (
        <section className="space-y-4">
          {live.map((challenge) => (
            <LiveChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Upcoming
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </section>
      )}

      {ended.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Past challenges
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {ended.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
