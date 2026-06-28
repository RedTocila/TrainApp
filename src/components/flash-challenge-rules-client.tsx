"use client";

import Link from "next/link";
import { ArrowLeft, CircleDollarSign, Clock, Scale, Trophy } from "lucide-react";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PlatformCopy } from "@/lib/platform-copy";

export function FlashChallengeRulesClient({
  copy,
  challengeTitle,
  backHref,
}: {
  copy: PlatformCopy["challenges"];
  challengeTitle: string;
  backHref: string;
}) {
  const flash = copy.flash;

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

        <Card className="border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-card to-card">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">{flash.intro}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {flash.windowLabel}
                </p>
                <p className="mt-1 text-sm font-bold">24 hours</p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <CircleDollarSign className="h-3 w-3" />
                  {flash.entryLabel}
                </p>
                <p className="mt-1 text-sm font-bold">€10</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">{copy.rulesTab}</h2>
          <Card>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <ul className="space-y-3">
                {flash.steps.map((step) => (
                  <li
                    key={step}
                    className="flex gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground"
                  >
                    <Scale className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    {step}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">{copy.instructionsTab}</h2>
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="flex items-start gap-3 p-4">
              <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {flash.zoomFromAnnouncement} {flash.zoomPending}
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </PageTransition>
  );
}
