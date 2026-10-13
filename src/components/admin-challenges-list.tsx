"use client";

import Link from "next/link";
import { format } from "date-fns";
import { GitBranch, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChallengeCategoryFilterBar } from "@/components/challenge-category-filter-bar";
import { StartChallengeButton } from "@/components/start-challenge-button";
import {
  countChallengesByCategory,
  filterChallengesByCategory,
  type ChallengeListCategory,
} from "@/lib/challenge-list-filters";
import { getChallengeGender } from "@/lib/challenge-gender";
import { isFlashChallenge } from "@/lib/challenge-series";
import { deleteChallenge, setChallengeShownLive } from "@/lib/actions/challenges";
import {
  challengeHasStarted,
  getChallengeDurationMonths,
  getChallengePrizePoolCents,
  getChallengeRegistrationStatus,
  getChallengeStatus,
  getPrizePoolCentsPerParticipant,
  MIN_PARTICIPANTS_TO_START,
} from "@/lib/challenge-utils";
import { formatEurosFromCents } from "@/lib/format-currency";
import type { Challenge } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function isShownLive(challenge: Challenge) {
  return challenge.published && challenge.is_active !== false;
}

function durationLabel(challenge: Challenge) {
  if (isFlashChallenge(challenge)) return "24 hours";
  if (challenge.duration_days === 30) return "30 days";
  if (challenge.duration_days === 90) return "90 days";
  return `${getChallengeDurationMonths(challenge)} months`;
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function ShowInAppSwitch({ challenge }: { challenge: Challenge }) {
  const router = useRouter();
  const [live, setLive] = useState(isShownLive(challenge));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={live}
        disabled={isPending}
        onClick={() => {
          const next = !live;
          setError(null);
          setLive(next);
          startTransition(async () => {
            try {
              await setChallengeShownLive(challenge.id, next);
              router.refresh();
            } catch (err) {
              setLive(!next);
              setError(err instanceof Error ? err.message : "Could not update this challenge.");
            }
          });
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors disabled:opacity-60",
          live
            ? "border-emerald-500/40 bg-emerald-500/10"
            : "border-border bg-secondary/50"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            live ? "bg-emerald-500" : "bg-zinc-600"
          )}
        >
          <span
            className={cn(
              "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform",
              live ? "translate-x-6" : "translate-x-1"
            )}
          />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">
            {live ? "Showing in the app" : "Hidden from the app"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {live
              ? "Clients can see this challenge and join it."
              : "Turn on to put this challenge on the live challenges page."}
          </span>
        </span>
      </button>
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function DeleteChallengeButton({ challengeId, title }: { challengeId: string; title: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full border-red-900/60 text-red-300"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
        startTransition(() => {
          void deleteChallenge(challengeId);
        });
      }}
    >
      <Trash2 className="h-4 w-4" />
      Delete
    </Button>
  );
}

export function AdminChallengesList({ challenges }: { challenges: Challenge[] }) {
  const [category, setCategory] = useState<ChallengeListCategory>("all");
  const counts = useMemo(() => countChallengesByCategory(challenges), [challenges]);
  const visibleChallenges = useMemo(
    () => filterChallengesByCategory(challenges, category),
    [challenges, category]
  );

  if (challenges.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No challenges scheduled yet
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ChallengeCategoryFilterBar
        category={category}
        counts={counts}
        onChange={setCategory}
        labels={{
          all: "All",
          flash: "Flash challenges",
          men: "Men",
          women: "Women",
        }}
      />

      {visibleChallenges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No challenges in this category
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleChallenges.map((challenge) => {
            const status = getChallengeStatus(challenge);
            const registrationStatus = getChallengeRegistrationStatus(challenge);
            const participantCount = challenge.participant_count ?? 0;
            const perEntry = formatEurosFromCents(getPrizePoolCentsPerParticipant(challenge));
            const pool = formatEurosFromCents(
              getChallengePrizePoolCents(challenge, participantCount)
            );
            const challengeGender = getChallengeGender(challenge);
            const started = challengeHasStarted(challenge);
            const genderLabel =
              challengeGender === "male" ? "Men" : challengeGender === "female" ? "Women" : "Open";

            return (
              <Card key={challenge.id}>
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        className={
                          challengeGender === "male"
                            ? "bg-blue-500/15 text-blue-300"
                            : challengeGender === "female"
                              ? "bg-pink-500/15 text-pink-300"
                              : undefined
                        }
                        variant={challengeGender ? "outline" : "secondary"}
                      >
                        {genderLabel}
                      </Badge>
                      <Badge variant="outline">{durationLabel(challenge)}</Badge>
                      <Badge variant="outline" className="capitalize">
                        {statusLabel(status)}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        Registration {statusLabel(registrationStatus)}
                      </Badge>
                    </div>
                    <h2 className="text-lg font-black leading-snug">{challenge.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {participantCount} registered
                      {started
                        ? ` · started ${format(new Date(challenge.scheduled_at), "MMM d, yyyy")}`
                        : ` · ${MIN_PARTICIPANTS_TO_START} needed to start`}
                      {" · "}
                      prize {pool} · +{perEntry} each
                    </p>
                  </div>

                  <ShowInAppSwitch key={`${challenge.id}-${String(isShownLive(challenge))}`} challenge={challenge} />

                  <div className="grid grid-cols-2 gap-2">
                    <Link href={`/admin/challenges/${challenge.id}/edit`} className="block">
                      <Button variant="outline" size="sm" className="w-full">
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    </Link>
                    <Link href={`/admin/challenges/${challenge.id}/bracket`} className="block">
                      <Button variant="outline" size="sm" className="w-full">
                        <GitBranch className="h-4 w-4" />
                        Bracket
                      </Button>
                    </Link>
                    {started ? null : (
                      <div className="col-span-2">
                        <StartChallengeButton
                          challenge={challenge}
                          participantCount={participantCount}
                          fullWidth
                        />
                      </div>
                    )}
                    <div className="col-span-2">
                      <DeleteChallengeButton challengeId={challenge.id} title={challenge.title} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
