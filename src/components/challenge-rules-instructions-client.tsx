import Link from "next/link";
import { ArrowLeft, ClipboardList, Scale } from "lucide-react";
import { PageTransition } from "@/components/page-transition";
import {
  EliminationFunnel,
  InstructionTimeline,
  JudgingSplitDiagram,
  RulesCategoryCards,
  TournamentFlowDiagram,
} from "@/components/challenge-tournament-visuals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PlatformCopy } from "@/lib/platform-copy";

function interpolate(text: string, groupSize: number, durationMonths: number) {
  return text
    .replace(/\{groupSize\}/g, String(groupSize))
    .replace(/\{count\}/g, String(durationMonths));
}

export function ChallengeRulesInstructionsClient({
  copy,
  challengeTitle,
  backHref,
  groupSize,
  durationMonths,
}: {
  copy: PlatformCopy["challenges"];
  challengeTitle: string;
  backHref: string;
  groupSize: number;
  durationMonths: number;
}) {
  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6 pb-8">
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {copy.backToChallenge}
          </Button>
        </Link>

        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {challengeTitle}
          </p>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            {copy.rulesAndInstructionsTitle}
          </h1>
        </header>

        <TournamentFlowDiagram
          copy={copy}
          groupSize={groupSize}
          durationMonths={durationMonths}
        />

        <RulesCategoryCards
          copy={copy}
          groupSize={groupSize}
          durationMonths={durationMonths}
        />

        <JudgingSplitDiagram copy={copy} />

        <EliminationFunnel copy={copy} groupSize={groupSize} />

        <section className="space-y-4">
          <h2 className="text-lg font-bold">{copy.rulesTab}</h2>
          <Card>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {interpolate(copy.rulesIntro, groupSize, durationMonths)}
              </p>
              <ul className="space-y-3">
                {copy.rules.map((rule) => (
                  <li
                    key={rule}
                    className="flex gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground"
                  >
                    <Scale className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {interpolate(rule, groupSize, durationMonths)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">{copy.instructionsTab}</h2>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-start gap-3 p-4">
              <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {interpolate(copy.instructionsIntro, groupSize, durationMonths)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 sm:p-6">
              <InstructionTimeline
                items={copy.instructions}
                groupSize={groupSize}
                durationMonths={durationMonths}
              />
            </CardContent>
          </Card>
        </section>
      </div>
    </PageTransition>
  );
}
