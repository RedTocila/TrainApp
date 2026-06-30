"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ChallengeCategoryFilterBar } from "@/components/challenge-category-filter-bar";
import { DeleteChallengeButton } from "@/components/delete-challenge-button";
import {
  countChallengesByCategory,
  filterChallengesByCategory,
  type ChallengeListCategory,
} from "@/lib/challenge-list-filters";
import { getChallengeGender } from "@/lib/challenge-gender";
import {
  getChallengeDurationMonths,
  getChallengePrizePoolCents,
  getChallengeRegistrationStatus,
  getChallengeStatus,
  getPrizePoolCentsPerParticipant,
  getRegistrationClosesAt,
  getRegistrationOpensAt,
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

            return (
              <Card key={challenge.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base">{challenge.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Starts {format(new Date(challenge.scheduled_at), "MMM d, yyyy · h:mm a")} ·{" "}
                      {getChallengeDurationMonths(challenge)}-month tournament ·{" "}
                      {challenge.duration_minutes} min calls · groups of {challenge.group_size}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Registration:{" "}
                      {getRegistrationOpensAt(challenge)
                        ? format(getRegistrationOpensAt(challenge)!, "MMM d · h:mm a")
                        : "open now"}{" "}
                      → {format(getRegistrationClosesAt(challenge), "MMM d · h:mm a")}
                    </p>
                    <p className="text-sm text-amber-200/90">
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
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Link href={`/admin/challenges/${challenge.id}/bracket`}>
                      <Button variant="default" size="sm">
                        Bracket
                      </Button>
                    </Link>
                    <Link href={`/admin/challenges/${challenge.id}/edit`}>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </Link>
                    <Badge variant={challenge.published ? "success" : "secondary"}>
                      {challenge.published ? "Published" : "Draft"}
                    </Badge>
                    <DeleteChallengeButton challengeId={challenge.id} />
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
