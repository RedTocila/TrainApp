"use client";

import Link from "next/link";
import { ArrowRight, Medal, Trophy, Users, Zap } from "lucide-react";
import { FadeIn } from "@/components/landing/landing-motion";
import { Button } from "@/components/ui/button";
import {
  GET_STARTED_CTA,
  GET_STARTED_HREF,
  LANDING_CHALLENGE_STEPS,
  LANDING_CHALLENGE_TYPES,
} from "@/lib/landing-content";

export function LandingChallenges() {
  return (
    <section
      id="challenges"
      className="landing-deferred-section scroll-mt-24 border-y border-border bg-card/20 px-4 py-16 sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <FadeIn className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Trophy className="h-3.5 w-3.5" />
            Community challenges
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
            Compete, stay accountable,
            <span className="block text-primary">win real prizes</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Join live flash events or longer transformation challenges. Show up,
            perform on camera, and climb the leaderboard — prize pools grow with
            every participant.
          </p>
        </FadeIn>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {LANDING_CHALLENGE_TYPES.map((item, index) => (
            <FadeIn key={item.title} delay={index * 0.05}>
              <div className="premium-card h-full p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
                <p className="mt-4 text-sm font-semibold text-primary">
                  {item.prize}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.1} className="mt-10">
          <div className="premium-card p-6 sm:p-8">
            <h3 className="text-lg font-bold">How it works</h3>
            <ol className="mt-5 grid gap-4 sm:grid-cols-3">
              {LANDING_CHALLENGE_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </FadeIn>

        <FadeIn delay={0.15} className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary" />
            Join with Elite
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            <Medal className="h-4 w-4 text-primary" />
            Prize pool splits among winners
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-primary" />
            Flash events run in 24-hour windows
          </span>
        </FadeIn>

        <FadeIn delay={0.2} className="mt-8 text-center">
          <Link href={GET_STARTED_HREF}>
            <Button size="lg" className="gap-2">
              {GET_STARTED_CTA}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}
