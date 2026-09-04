"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { ChallengeCategoryFilterBar } from "@/components/challenge-category-filter-bar";
import { DeleteChallengeButton } from "@/components/delete-challenge-button";
import { StartChallengeButton } from "@/components/start-challenge-button";
import {
  countChallengesByCategory,
  filterChallengesByCategory,
  type ChallengeListCategory,
} from "@/lib/challenge-list-filters";
import { getChallengeGender } from "@/lib/challenge-gender";
import {
  challengeHasStarted,
  getChallengeDurationMonths,
  getChallengePrizePoolCents,
  getChallengeRegistrationStatus,
  getChallengeStatus,
  getPrizePoolCentsPerParticipant,
  getRegistrationClosesAt,
  getRegistrationOpensAt,
  isChallengeActive,
  MIN_PARTICIPANTS_TO_START,
} from "@/lib/challenge-utils";
import { formatEurosFromCents } from "@/lib/format-currency";
import type { Challenge } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
            const registrationCloses = getRegistrationClosesAt(challenge);

            return (
              <Card key={challenge.id}>
                <CardHeader className="space-y-3 p-4 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <CardTitle className="text-base leading-snug break-words">
                        {challenge.title}
                      </CardTitle>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {started
                          ? `Started ${format(new Date(challenge.scheduled_at), "MMM d, yyyy · h:mm a")}`
                          : `Manual start · min ${MIN_PARTICIPANTS_TO_START} participants (${participantCount} registered)`}
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {getChallengeDurationMonths(challenge)}-month tournament ·{" "}
                        {challenge.duration_minutes} min calls · groups of {challenge.group_size}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Registration:{" "}
                        {getRegistrationOpensAt(challenge)
                          ? format(getRegistrationOpensAt(challenge)!, "MMM d · h:mm a")
                          : "open now"}{" "}
                        →{" "}
                        {registrationCloses
                          ? format(registrationCloses, "MMM d · h:mm a")
                          : "until you start"}
                      </p>
                      <p className="text-sm leading-relaxed text-amber-200/90">
                        Prize pool: {pool} · +{perEntry}/entry · {participantCount} registered
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Badge variant="outline">{status}</Badge>
                        <Badge variant="outline">{registrationStatus}</Badge>
                        {challengeGender === "male" ? (
                          <Badge className="bg-blue-500/15 text-blue-400">Men</Badge>
                        ) : challengeGender === "female" ? (
                          <Badge className="bg-pink-500/15 text-pink-400">Women</Badge>
                        ) : (
                          <Badge variant="secondary">Open</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:max-w-[16rem] sm:items-stretch">
                      <StartChallengeButton
                        challenge={challenge}
                        participantCount={participantCount}
                        fullWidth
                      />
                      <div className="flex w-full flex-wrap items-center gap-2 sm:justify-end">
                        <Link
                          href={`/admin/challenges/${challenge.id}/bracket`}
                          className="min-w-0 flex-1 sm:flex-none"
                        >
                          <Button variant="default" size="sm" className="w-full sm:w-auto">
                            Bracket
                          </Button>
                        </Link>
                        <Link
                          href={`/admin/challenges/${challenge.id}/edit`}
                          className="min-w-0 flex-1 sm:flex-none"
                        >
                          <Button variant="outline" size="sm" className="w-full sm:w-auto">
                            Edit
                          </Button>
                        </Link>
                        <Badge variant={challenge.published ? "success" : "secondary"}>
                          {challenge.published ? "Published" : "Draft"}
                        </Badge>
                        <Badge
                          variant={isChallengeActive(challenge) ? "success" : "secondary"}
                        >
                          {isChallengeActive(challenge) ? "Active" : "Inactive"}
                        </Badge>
                        <DeleteChallengeButton challengeId={challenge.id} />
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
