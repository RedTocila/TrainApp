"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GET_STARTED_CTA,
  GET_STARTED_HREF,
  LANDING_HERO_COACH_ROWS,
  LANDING_HERO_FEATURES,
  LANDING_HERO_STATS,
} from "@/lib/landing-content";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-5 pb-14 pt-[calc(4.5rem+1.75rem)] sm:px-6 sm:pt-[calc(4.5rem+3rem)] lg:pb-24">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/95 via-background/85 to-transparent"
        aria-hidden
      />
      <HeroArcs />

      <div className="relative z-10 mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14">
        <div>
          <h1 className="text-[2.9rem] font-black leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Your personal
            <span className="block text-primary">AI fitness coach.</span>
          </h1>

          <p className="mt-4 max-w-md text-lg leading-snug text-muted-foreground sm:text-xl">
            Custom workouts. Simple nutrition. Real progress.
          </p>

          <div className="mt-8 max-w-md">
            <Link
              href={GET_STARTED_HREF}
              className="group flex h-14 w-full items-center justify-center gap-3 rounded-full bg-primary px-6 text-base font-bold text-primary-foreground shadow-[0_10px_40px_-6px_rgba(var(--primary-rgb),0.75)] transition-all hover:brightness-110 active:scale-[0.98] sm:h-16 sm:text-lg"
            >
              {GET_STARTED_CTA}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              2-min questionnaire · Plans from €20/mo
            </p>
            <p className="mt-1.5 text-center text-sm text-muted-foreground">
              Already a member?{" "}
              <Link
                href="/login"
                className="font-semibold text-foreground underline-offset-4 hover:underline"
              >
                Log in
              </Link>
            </p>
          </div>

          <ul className="mt-8 grid max-w-md grid-cols-4 gap-2">
            {LANDING_HERO_FEATURES.map(({ icon: Icon, label, iconClassName }) => (
              <li key={label} className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm">
                  <Icon
                    className={cn("h-6 w-6 text-primary", iconClassName)}
                    strokeWidth={2.25}
                  />
                </span>
                <span className="text-[13px] font-semibold leading-tight text-foreground">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <AiCoachCard />
          <HeroStats />
        </div>
      </div>
    </section>
  );
}

function HeroArcs() {
  return (
    <div
      className="pointer-events-none absolute -right-40 -top-48 h-[30rem] w-[30rem] sm:-right-24 sm:-top-40 lg:h-[42rem] lg:w-[42rem]"
      aria-hidden
    >
      <div className="absolute inset-0 rounded-full border-[28px] border-primary/25 blur-[2px]" />
      <div className="absolute inset-12 rounded-full border-[18px] border-primary/40 shadow-[0_0_60px_rgba(var(--primary-rgb),0.45)]" />
      <div className="absolute inset-24 rounded-full border-2 border-primary/30" />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(var(--primary-rgb),0.18),transparent_65%)]" />
    </div>
  );
}

function AiCoachCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card/80 to-card/60 p-5 shadow-[0_20px_60px_-20px_rgba(var(--primary-rgb),0.45)] backdrop-blur-md sm:p-6">
      <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" aria-hidden />

      <div className="relative grid grid-cols-[1fr_1.05fr] items-center gap-3 sm:gap-5">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-5 w-5" />
            AI Coach
          </p>
          <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight text-foreground sm:text-3xl">
            Programs that adapt to you.
          </h2>
          <p className="mt-2 text-sm leading-snug text-muted-foreground">
            Your goals, your equipment, your schedule. The AI adjusts everything.
          </p>
        </div>

        <div className="-mb-10 -mr-8 rotate-[-4deg] rounded-[1.75rem] border border-primary/40 bg-zinc-950/90 p-2 shadow-[0_0_40px_rgba(var(--primary-rgb),0.35)] sm:-mr-4">
          <div className="space-y-2 rounded-[1.35rem] bg-zinc-900/80 p-2">
            {LANDING_HERO_COACH_ROWS.map((row) => (
              <div
                key={row.title}
                className="flex items-center gap-2 rounded-xl border border-white/5 bg-zinc-800/60 p-2"
              >
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-950">
                  {row.image ? (
                    <Image
                      src={row.image}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <ChartNoAxesColumnIncreasing
                      className="h-6 w-6 text-primary"
                      strokeWidth={2.5}
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-white">
                    {row.title}
                  </span>
                  <span className="block truncate text-[10px] text-zinc-400">
                    {row.subtitle}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStats() {
  return (
    <dl className="grid grid-cols-3">
      {LANDING_HERO_STATS.map(({ icon: Icon, value, label }, i) => (
        <div
          key={label}
          className={cn(
            "flex flex-col items-center gap-1 px-2 text-center",
            i > 0 && "border-l border-border/60"
          )}
        >
          <Icon className="mb-1 h-6 w-6 text-primary" strokeWidth={1.75} />
          <dt className="sr-only">{label}</dt>
          <dd className="text-2xl font-black tracking-tight text-foreground">{value}</dd>
          <dd className="text-xs text-muted-foreground">{label}</dd>
        </div>
      ))}
    </dl>
  );
}
