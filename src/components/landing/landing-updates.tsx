"use client";

import { LANDING_UPDATES } from "@/lib/landing-content";
import { FadeIn, StaggerGrid, StaggerGridItem } from "@/components/landing/landing-motion";
import { Badge } from "@/components/ui/badge";

export function LandingUpdates() {
  return (
    <section id="updates" className="scroll-mt-24 border-y border-border bg-card/30 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            What&apos;s new
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Latest updates
          </h2>
          <p className="mt-4 text-muted-foreground">
            We ship fast. Here&apos;s what landed recently in TrainApp.
          </p>
        </FadeIn>

        <StaggerGrid className="mt-12 grid gap-4 md:grid-cols-2">
          {LANDING_UPDATES.map((update) => (
            <StaggerGridItem key={update.title}>
              <article className="premium-card h-full p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {update.tag}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{update.date}</span>
                </div>
                <h3 className="mt-3 text-lg font-bold">{update.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {update.description}
                </p>
              </article>
            </StaggerGridItem>
          ))}
        </StaggerGrid>
      </div>
    </section>
  );
}
