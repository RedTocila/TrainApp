"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Bot, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GET_STARTED_CTA,
  GET_STARTED_HREF,
  LANDING_HERO_MARKETING_IMAGE,
  LANDING_HIGHLIGHTS,
} from "@/lib/landing-content";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-[calc(4.5rem+2.5rem)] sm:px-6 sm:pt-[calc(4.5rem+3.5rem)] lg:pb-24">
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI-powered fitness
          </div>

          <h1 className="text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Real coach.
            <span className="block text-primary">Real results.</span>
          </h1>

          <p className="mx-auto max-w-xl text-base text-muted-foreground sm:text-lg lg:mx-0">
            AI Coach that trains you, adapts to you, and gets you results — with
            workouts, nutrition, and live challenges in one platform.
          </p>

          <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
            {LANDING_HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium"
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                {label}
              </span>
            ))}
          </div>

          <div className="flex justify-center lg:justify-start">
            <Link href={GET_STARTED_HREF}>
              <Button size="lg" className="gap-2 px-8">
                {GET_STARTED_CTA}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <p className="text-sm text-muted-foreground">
            2-min questionnaire · Free to browse · Plans from €20/mo
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-primary/15 blur-3xl" />
          <div className="premium-card relative overflow-hidden shadow-2xl shadow-primary/10">
            <Image
              src={LANDING_HERO_MARKETING_IMAGE}
              alt="RUTINA AI Coach — personalized training with real-time coaching and progress tracking"
              width={1200}
              height={900}
              priority
              sizes="(min-width: 1024px) 560px, 92vw"
              className="h-auto w-full object-cover"
            />
          </div>

          <div className="pointer-events-none absolute -left-2 top-4 z-10 flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-bold shadow-md sm:-left-3">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            Live challenges
          </div>

          <div className="pointer-events-none absolute -bottom-2 -right-2 z-10 flex items-center gap-2 rounded-lg border border-primary/30 bg-card px-2.5 py-1.5 shadow-md sm:-right-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">AI insight</p>
              <p className="text-[11px] font-bold">Form on point</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
