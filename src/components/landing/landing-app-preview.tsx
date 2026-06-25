"use client";

import Image from "next/image";
import { MonitorSmartphone } from "lucide-react";
import { FadeIn } from "@/components/landing/landing-motion";
import {
  LANDING_APP_PREVIEW_HIGHLIGHTS,
  LANDING_FEATURES,
  LANDING_HERO_IMAGE,
} from "@/lib/landing-content";
import { cn } from "@/lib/utils";

export function LandingAppPreview() {
  return (
    <section className="landing-deferred-section border-y border-border bg-card/20 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="space-y-6 text-center lg:text-left">
            <FadeIn>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <MonitorSmartphone className="h-3.5 w-3.5" />
                Inside the app
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                Smarter workouts.
                <span className="block text-primary">Better results.</span>
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Personalized workout plans, adaptive programs, and progress tracking —
                dashboard on desktop, guided workouts on your phone, all in one place.
              </p>
            </FadeIn>

            <ul className="space-y-4">
              {LANDING_APP_PREVIEW_HIGHLIGHTS.map((item, i) => (
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

          <div className="relative mx-auto w-full max-w-xl [content-visibility:visible]">
            <div
              className="pointer-events-none absolute -inset-6 rounded-3xl bg-primary/15 blur-3xl"
              aria-hidden
            />
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl">
              <Image
                src={LANDING_HERO_IMAGE}
                alt="RUTINA app on laptop and phone — dashboard, workouts, and progress tracking"
                fill
                sizes="(min-width: 1024px) 560px, 90vw"
                className="object-contain object-center"
              />
            </div>
          </div>
        </div>

        <FadeIn delay={0.1} className="mt-12">
          <p className="mb-6 text-center text-xs font-bold uppercase tracking-widest text-primary">
            Features
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LANDING_FEATURES.map((feature) => (
              <article
                key={feature.title}
                className={cn(
                  "premium-card flex items-start gap-3 overflow-hidden p-3.5 transition-transform duration-300 hover:-translate-y-0.5 sm:p-4",
                  "bg-gradient-to-br",
                  feature.accent
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background/80 text-primary shadow-sm">
                  <feature.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold sm:text-base">{feature.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{feature.tagline}</p>
                </div>
              </article>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
