"use client";

import { LANDING_FEATURES } from "@/lib/landing-content";
import {
  FadeIn,
  StaggerGrid,
  StaggerGridItem,
} from "@/components/landing/landing-motion";

export function LandingFeatures() {
  return (
    <section id="features" className="scroll-mt-24 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Everything in one app
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Built for serious training
          </h2>
          <p className="mt-4 text-muted-foreground">
            From daily habits to coach-delivered plans — LevelUp keeps your
            workout, nutrition, and progress aligned.
          </p>
        </FadeIn>

        <StaggerGrid className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_FEATURES.map((feature) => (
            <StaggerGridItem key={feature.title}>
              <article className="premium-card group h-full p-6 transition-transform duration-300 hover:-translate-y-1">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary transition-colors group-hover:bg-primary/25">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            </StaggerGridItem>
          ))}
        </StaggerGrid>
      </div>
    </section>
  );
}
