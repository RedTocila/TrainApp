"use client";

import { useState } from "react";
import Image from "next/image";
import {
  LANDING_TRANSFORMATIONS,
  type LandingTransformation,
} from "@/lib/landing-content";
import { FadeIn } from "@/components/landing/landing-motion";
import { cn } from "@/lib/utils";

function TransformationCard({ item }: { item: LandingTransformation }) {
  const durationLabel =
    item.months === 1 ? "1 month" : `${item.months} months`;

  return (
    <figure className="flex w-[min(100vw-2rem,22rem)] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card sm:w-96">
      <div className="relative aspect-[3/2] w-full">
        <Image
          src={item.image}
          alt={item.alt}
          fill
          unoptimized
          sizes="(min-width: 640px) 384px, 85vw"
          className="object-cover object-center"
        />
      </div>

      <figcaption className="border-t border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black tracking-tight sm:text-base">
            −{item.kgLost} kg
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
  );
}

function TransformationMarqueeRow({
  items,
  direction,
}: {
  items: LandingTransformation[];
  direction: "left" | "right";
}) {
  const [paused, setPaused] = useState(false);
  const loop = [...items, ...items];

  return (
    <div
      className="landing-reviews-marquee-mask overflow-hidden py-1"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <div
        className={cn(
          "flex w-max gap-4 px-4",
          direction === "left"
            ? "landing-reviews-marquee-left"
            : "landing-reviews-marquee-right"
        )}
        style={{ animationPlayState: paused ? "paused" : "running" }}
      >
        {loop.map((item, i) => (
          <TransformationCard key={`${item.image}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

const midpoint = Math.ceil(LANDING_TRANSFORMATIONS.length / 2);
const transformationsRowLeft = LANDING_TRANSFORMATIONS.slice(0, midpoint);
const transformationsRowRight = LANDING_TRANSFORMATIONS.slice(midpoint);

export function LandingTransformations() {
  return (
    <section
      id="transformations"
      className="landing-deferred-section scroll-mt-24 overflow-hidden border-y border-border bg-card/20 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Transformations
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Before & after. Real results.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Members tracking workouts, meals, and habits — turning consistency into
            visible progress.
          </p>
        </FadeIn>
      </div>

      <div className="mt-12 space-y-4" aria-label="Member body transformations">
        <TransformationMarqueeRow items={transformationsRowLeft} direction="left" />
        <TransformationMarqueeRow items={transformationsRowRight} direction="right" />
      </div>
    </section>
  );
}
