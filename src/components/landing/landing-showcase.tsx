"use client";

import Image from "next/image";
import { Brain, Camera, TrendingUp, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/landing/landing-motion";
import {
  LANDING_AI_PREDICTIONS_IMAGE,
  LANDING_MEAL_PHOTO_LOG_IMAGE,
  LANDING_TRACK_PROGRESS_IMAGE,
} from "@/lib/landing-content";

const panels: {
  icon: LucideIcon;
  title: string;
  color: string;
  image: string;
  alt: string;
  caption: string;
}[] = [
  {
    icon: Camera,
    title: "Snap & log meals",
    color: "text-violet-400",
    image: LANDING_MEAL_PHOTO_LOG_IMAGE,
    alt: "Photo meal log — snap a meal, get macros and ingredient breakdown",
    caption: "Snap a photo → AI logs calories & macros",
  },
  {
    icon: TrendingUp,
    title: "Track progress",
    color: "text-emerald-400",
    image: LANDING_TRACK_PROGRESS_IMAGE,
    alt: "Track progress — weight, photos, habits, and body metrics in one dashboard",
    caption: "Weight, photos, habits & metrics — all in one view",
  },
  {
    icon: Brain,
    title: "AI predictions",
    color: "text-sky-400",
    image: LANDING_AI_PREDICTIONS_IMAGE,
    alt: "AI predictions — workouts, nutrition, sleep and weight turned into forecasts",
    caption: "Your data in → AI forecasts where you're headed",
  },
];

export function LandingShowcase() {
  return (
    <section className="landing-deferred-section px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <FadeIn className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            See it in action
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Data that motivates
          </h2>
        </FadeIn>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {panels.map((panel) => (
            <div key={panel.title}>
              <div className="flex items-center gap-2">
                <panel.icon className={`h-5 w-5 shrink-0 ${panel.color}`} />
                <h3 className="font-bold">{panel.title}</h3>
              </div>

              <div className="relative mt-3 aspect-[3/2] w-full overflow-hidden rounded-2xl">
                <Image
                  src={panel.image}
                  alt={panel.alt}
                  fill
                  unoptimized
                  sizes="(min-width: 768px) 320px, 90vw"
                  className="object-contain object-center"
                />
              </div>

              <p className="mt-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                {panel.caption}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
