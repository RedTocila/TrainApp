"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  GET_STARTED_CTA,
  GET_STARTED_HREF,
  LANDING_FEATURES,
} from "@/lib/landing-content";
import {
  FadeIn,
  StaggerGrid,
  StaggerGridItem,
} from "@/components/landing/landing-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingFeatures() {
  return (
    <section id="features" className="scroll-mt-24 border-y border-border bg-card/20 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <FadeIn className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Features
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Everything you need
          </h2>
        </FadeIn>

        <StaggerGrid className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_FEATURES.map((feature) => (
            <StaggerGridItem key={feature.title}>
              <article
                className={cn(
                  "group premium-card relative h-full overflow-hidden p-5 transition-transform duration-300 hover:-translate-y-1",
                  "bg-gradient-to-br",
                  feature.accent
                )}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-background/80 text-primary shadow-sm">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{feature.tagline}</p>
              </article>
            </StaggerGridItem>
          ))}
        </StaggerGrid>

        <FadeIn delay={0.1} className="mt-10 text-center">
          <Link href={GET_STARTED_HREF}>
            <Button variant="outline" className="gap-2">
              {GET_STARTED_CTA}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}
