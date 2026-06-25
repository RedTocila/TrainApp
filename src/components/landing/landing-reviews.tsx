"use client";

import { useState } from "react";
import Link from "next/link";
import { Quote, Star } from "lucide-react";
import {
  GET_STARTED_HREF,
  LANDING_REVIEWS,
  type LandingReview,
} from "@/lib/landing-content";
import { FadeIn } from "@/components/landing/landing-motion";
import { cn } from "@/lib/utils";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25"
          )}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: LandingReview }) {
  return (
    <Link
      href={GET_STARTED_HREF}
      className="premium-card relative z-10 flex w-[min(100vw-2rem,20rem)] shrink-0 cursor-pointer flex-col p-5 transition-shadow hover:shadow-lg hover:shadow-primary/10 sm:w-80"
    >
      <Quote className="h-8 w-8 text-primary/20" aria-hidden />
      <StarRating rating={review.rating} />
      <blockquote className="mt-3 flex-1 text-sm leading-relaxed">
        &ldquo;{review.quote}&rdquo;
      </blockquote>
      <footer className="mt-4 border-t border-border pt-4">
        <p className="font-bold">{review.name}</p>
        <p className="text-xs text-muted-foreground">{review.context}</p>
      </footer>
    </Link>
  );
}

function ReviewMarqueeRow({
  reviews,
  direction,
}: {
  reviews: LandingReview[];
  direction: "left" | "right";
}) {
  const [paused, setPaused] = useState(false);
  const items = [...reviews, ...reviews];

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
        {items.map((review, i) => (
          <ReviewCard key={`${review.name}-${i}`} review={review} />
        ))}
      </div>
    </div>
  );
}

const midpoint = Math.ceil(LANDING_REVIEWS.length / 2);
const reviewsRowLeft = LANDING_REVIEWS.slice(0, midpoint);
const reviewsRowRight = LANDING_REVIEWS.slice(midpoint);

export function LandingReviews() {
  return (
    <section
      id="reviews"
      className="landing-deferred-section scroll-mt-24 overflow-hidden py-16 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Reviews
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Real people. Real progress.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Members use RUTINA to train smarter, eat better, and stay accountable —
            with or without a live coach.
          </p>
        </FadeIn>
      </div>

      <div className="mt-12 space-y-4" aria-label="Member reviews">
        <ReviewMarqueeRow reviews={reviewsRowLeft} direction="left" />
        <ReviewMarqueeRow reviews={reviewsRowRight} direction="right" />
      </div>
    </section>
  );
}
