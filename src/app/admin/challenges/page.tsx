import Link from "next/link";
import { requireAdmin } from "@/lib/actions/auth";
import { getAllChallenges } from "@/lib/actions/challenges";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteChallengeButton } from "@/components/delete-challenge-button";
import { getChallengeStatus } from "@/lib/challenge-utils";
import { Plus } from "lucide-react";
import { format } from "date-fns";

export default async function AdminChallengesPage() {
  await requireAdmin();
  const challenges = await getAllChallenges();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-black">Challenges</h1>
            <p className="text-muted-foreground">
              Tournament challenges with Zoom calls — winners chosen by who transformed the most on
              video, not checkmark totals
            </p>
          </div>
          <Link href="/admin/challenges/new" className="shrink-0">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New challenge
            </Button>
          </Link>
        </div>

        {challenges.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No challenges scheduled yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {challenges.map((challenge) => {
              const status = getChallengeStatus(challenge);
              return (
                <Card key={challenge.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-base">{challenge.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(challenge.scheduled_at), "MMM d, yyyy · h:mm a")} ·{" "}
                        {challenge.duration_minutes} min · groups of {challenge.group_size}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Badge variant="outline">{status}</Badge>
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
    </PageTransition>
  );
}
