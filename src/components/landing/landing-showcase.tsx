"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Brain, Camera, TrendingUp } from "lucide-react";
import { FadeIn } from "@/components/landing/landing-motion";
import {
  ProgressRing,
  WeightTrendChart,
} from "@/components/landing/landing-visuals";

const panels = [
  {
    icon: Camera,
    title: "Snap & log meals",
    color: "text-violet-400",
    visual: (
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-secondary/20">
        <div className="relative aspect-[4/3] w-full">
          <Image
            src="/landing/meal-photo-log.png"
            alt="Log meals by taking a picture"
            fill
            sizes="(min-width: 768px) 320px, 90vw"
            className="object-cover"
            priority
          />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
          <span className="font-semibold text-muted-foreground">
            Take a photo → get macros matched
          </span>
          <span className="rounded-full border border-border bg-card/70 px-2 py-1 font-bold">
            Photo Log
          </span>
        </div>
      </div>
    ),
  },
  {
    icon: TrendingUp,
    title: "Track progress",
    color: "text-emerald-400",
    visual: <WeightTrendChart className="mt-4" />,
  },
  {
    icon: Brain,
    title: "AI predictions",
    color: "text-sky-400",
    visual: (
      <div className="mt-4 flex justify-center">
        <ProgressRing value={92} label="On track" sublabel="4-week forecast" />
      </div>
    ),
  },
];

export function LandingShowcase() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <FadeIn className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            See it in action
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Data that motivates
          </h2>
        </FadeIn>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {panels.map((panel, i) => (
            <motion.div
              key={panel.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ y: -4 }}
              className="premium-card overflow-hidden p-5"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-secondary ${panel.color}`}>
                  <panel.icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold">{panel.title}</h3>
              </div>
              {panel.visual}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
