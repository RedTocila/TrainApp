"use client";

import Link from "next/link";
import { ArrowRight, Bot, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroGlow } from "@/components/landing/landing-motion";
import {
  GET_STARTED_CTA,
  GET_STARTED_HREF,
  LANDING_HIGHLIGHTS,
} from "@/lib/landing-content";
import {
  MacroBars,
  ProgressRing,
  WeekStrip,
  WeightTrendChart,
} from "@/components/landing/landing-visuals";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:pb-24">
      <HeroGlow />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI-powered fitness
          </div>

          <h1 className="text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Train smarter.
            <span className="block text-primary">See results faster.</span>
          </h1>

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
            2-min questionnaire · Free to browse · Plans from €7/mo
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div className="premium-card relative overflow-hidden p-5 shadow-2xl shadow-primary/10 sm:p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-violet-500/5" />
            <div className="relative grid gap-4 sm:grid-cols-2">
              <div className="space-y-4 sm:col-span-2">
                <MacroBars className="rounded-xl border border-border bg-secondary/30 p-4" />
              </div>
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <WeightTrendChart />
              </div>
              <div className="flex items-center justify-center rounded-xl border border-border bg-secondary/30 p-4">
                <ProgressRing value={78} label="Today" sublabel="Goals hit" />
              </div>
              <div className="rounded-xl border border-border bg-secondary/30 p-4 sm:col-span-2">
                <WeekStrip />
              </div>
            </div>
          </div>

          <div className="absolute -bottom-3 -right-2 flex items-center gap-2 rounded-xl border border-primary/30 bg-card px-3 py-2 shadow-lg sm:-right-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">AI insight</p>
              <p className="text-xs font-bold">+12g protein tip</p>
            </div>
          </div>

          <div className="absolute -left-2 top-8 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg sm:-left-4">
            <Zap className="h-4 w-4 text-amber-400" />
            <p className="text-xs font-bold">HIIT · 7PM tonight</p>
          </div>
        </div>
      </div>
    </section>
  );
}
