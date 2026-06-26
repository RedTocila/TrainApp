"use client";

import Link from "next/link";
import { ArrowRight, Bot, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <section className="relative overflow-hidden px-4 pb-16 pt-[calc(4.5rem+2.5rem)] sm:px-6 sm:pt-[calc(4.5rem+3.5rem)] lg:pb-24">
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
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
            2-min questionnaire · Free to browse · Plans from €20/mo
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

          <div className="pointer-events-none absolute -left-2 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-[11px] font-bold shadow-md backdrop-blur-sm sm:-left-3">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            HIIT · 7PM
          </div>

          <div className="pointer-events-none absolute -bottom-2 -right-2 z-10 flex items-center gap-2 rounded-lg border border-primary/30 bg-card/95 px-2.5 py-1.5 shadow-md backdrop-blur-sm sm:-right-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">AI insight</p>
              <p className="text-[11px] font-bold">+12g protein</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
