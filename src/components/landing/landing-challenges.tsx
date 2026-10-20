"use client";

import Link from "next/link";
import { ArrowRight, Medal, Trophy, Users, Video, Zap, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/landing/landing-motion";
import { FunnelConnector } from "@/components/landing/landing-visuals";
import { Button } from "@/components/ui/button";
import {
  GET_STARTED_CTA,
  GET_STARTED_HREF,
  LANDING_CHALLENGE_STEPS,
  LANDING_CHALLENGE_TYPES,
} from "@/lib/landing-content";

const STEP_ICONS: LucideIcon[] = [Trophy, Video, Medal];

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
          <p className="mx-auto mt-3 text-sm text-muted-foreground">
            Live events or longer runs.
          </p>
        </FadeIn>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {LANDING_CHALLENGE_TYPES.map((item, index) => (
            <FadeIn key={item.title} delay={index * 0.05}>
              <div className="premium-card flex h-full flex-col p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <item.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-xl font-bold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                <p className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Medal className="h-3.5 w-3.5" />
                  {item.prize}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.1} className="mt-10">
          <ol className="flex flex-col items-stretch md:flex-row md:items-center md:justify-center">
            {LANDING_CHALLENGE_STEPS.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? Trophy;
              return (
                <li key={step.title} className="flex flex-col items-center md:flex-row">
                  <div className="premium-card flex w-full max-w-xs flex-col items-center p-6 text-center md:w-52">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                      <Icon className="h-7 w-7" />
                    </div>
                    <span className="mt-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                    <h3 className="mt-2 font-bold">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  {index < LANDING_CHALLENGE_STEPS.length - 1 && <FunnelConnector />}
                </li>
              );
            })}
          </ol>
        </FadeIn>

        <FadeIn delay={0.15} className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary" />
            Elite members
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            <Medal className="h-4 w-4 text-primary" />
            Prize pool
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-primary" />
            24-hour windows
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
