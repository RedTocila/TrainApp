"use client";

import Image from "next/image";
import { Sparkles } from "lucide-react";
import { AI_COACH_AVATAR_SRC } from "@/components/ai-coach-avatar";
import { FadeIn } from "@/components/landing/landing-motion";
import { COACH_ALEX_HIGHLIGHTS } from "@/lib/landing-content";

export function LandingCoachAlex() {
  return (
    <section
      id="coach-alex"
      className="landing-deferred-section scroll-mt-24 border-y border-border bg-card/20 px-4 py-16 sm:px-6 sm:py-20"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <FadeIn className="relative mx-auto w-full max-w-sm">
          <div className="pointer-events-none absolute -inset-8 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative mx-auto aspect-square w-full">
            <Image
              src={AI_COACH_AVATAR_SRC}
              alt="Coach Alex — your AI fitness coach"
              fill
              sizes="(min-width: 1024px) 480px, 90vw"
              className="rounded-full object-cover"
              priority={false}
            />
          </div>
        </FadeIn>

        <div className="space-y-6 text-center lg:text-left">
          <FadeIn>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Meet Coach Alex
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Your coach who helps you
              <span className="block text-primary">show up and win</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Coach Alex is built to help you hit your goals — logging meals, crushing
              workouts, and staying consistent when motivation fades. Honest feedback
              that motivates, not coddles.
            </p>
          </FadeIn>

          <ul className="space-y-4">
            {COACH_ALEX_HIGHLIGHTS.map((item, i) => (
              <FadeIn key={item.title} delay={0.05 * (i + 1)}>
                <li className="flex gap-4 text-left">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold">{item.title}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </li>
              </FadeIn>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
