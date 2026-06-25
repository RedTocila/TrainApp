"use client";

import Link from "next/link";
import { ArrowRight, Clock, Euro, Sparkles, Zap } from "lucide-react";
import {
  GET_STARTED_CTA,
  GET_STARTED_HREF,
  LANDING_STATS,
} from "@/lib/landing-content";
import { PLATFORM_NAME } from "@/lib/brand";
import { FadeIn } from "@/components/landing/landing-motion";
import { Button } from "@/components/ui/button";

const statIcons = [Clock, Euro, Sparkles, Zap];

export function LandingCta() {
  return (
    <section className="landing-deferred-section px-4 py-16 sm:px-6 sm:py-20">
      <FadeIn>
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card to-card p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/15" />
          <div className="relative space-y-5">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Ready for {PLATFORM_NAME}?
            </h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Answer a few questions, create your account, then pick a package — or skip straight to your dashboard.
            </p>
            <Link href={GET_STARTED_HREF}>
              <Button size="lg" className="gap-2 px-8">
                {GET_STARTED_CTA}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          {LANDING_STATS.map((stat, i) => {
            const Icon = statIcons[i] ?? Sparkles;
            return (
              <div
                key={stat.label}
                className="flex flex-col items-center rounded-xl border border-border bg-card/50 p-4 text-center"
              >
                <Icon className="mb-2 h-5 w-5 text-primary" />
                <p className="text-xl font-black text-primary sm:text-2xl">{stat.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </FadeIn>
    </section>
  );
}
