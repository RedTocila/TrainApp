"use client";

import Image from "next/image";
import { UserRound } from "lucide-react";
import {
  LANDING_FOUNDER_BIO,
  LANDING_FOUNDER_IMAGE,
} from "@/lib/landing-content";
import { FadeIn } from "@/components/landing/landing-motion";

export function LandingFounderBio() {
  const { name, role, headline, paragraphs, kgLost, months, imageAlt } =
    LANDING_FOUNDER_BIO;
  const durationLabel = months === 1 ? "1 month" : `${months} months`;

  return (
    <section
      id="founder"
      className="landing-deferred-section scroll-mt-24 border-y border-border bg-card/20 px-4 py-16 sm:px-6 sm:py-20"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <FadeIn className="order-2 lg:order-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <UserRound className="h-3.5 w-3.5" />
            {role}
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
            {headline}
          </h2>
          <div className="mt-5 space-y-4 text-sm text-muted-foreground sm:text-base">
            {paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          <p className="mt-6 text-lg font-black tracking-tight">
            — {name}
          </p>
        </FadeIn>

        <FadeIn className="order-1 lg:order-2">
          <figure className="mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <div className="relative aspect-[3/2] w-full">
              <Image
                src={LANDING_FOUNDER_IMAGE}
                alt={imageAlt}
                fill
                unoptimized
                sizes="(min-width: 1024px) 512px, 90vw"
                className="object-cover object-center"
              />
            </div>
            <figcaption className="border-t border-border bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black tracking-tight sm:text-base">
                  −{kgLost} kg
                  <span className="font-semibold text-muted-foreground">
                    {" "}
                    in {durationLabel}
                  </span>
                </p>
                <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                    Before
                  </span>
                  <span className="text-muted-foreground/40" aria-hidden>
                    →
                  </span>
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-primary">
                    After
                  </span>
                </div>
              </div>
            </figcaption>
          </figure>
        </FadeIn>
      </div>
    </section>
  );
}
