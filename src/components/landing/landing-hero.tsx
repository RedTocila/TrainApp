"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Calendar,
  Droplets,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroGlow } from "@/components/landing/landing-motion";

const previewCards = [
  { icon: Calendar, label: "Today's plan", value: "Push + 2,100 kcal" },
  { icon: Droplets, label: "Water", value: "1.8 L / 2.5 L" },
  { icon: Bot, label: "AI Coach", value: "Meal logged ✓" },
];

export function LandingHero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:pb-28">
      <HeroGlow />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-8 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Train smarter with AI
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl"
          >
            Your coach.
            <span className="block text-primary">Your calendar.</span>
            Your results.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="mx-auto max-w-xl text-lg text-muted-foreground lg:mx-0"
          >
            LevelUp combines workouts, nutrition, AI coaching, and live sessions
            in one premium dashboard — built for people who take training seriously.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start"
          >
            <Link href="/register">
              <Button size="lg" className="w-full gap-2 sm:w-auto">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#pricing">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                View pricing
              </Button>
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-sm text-muted-foreground"
          >
            Browse free · Subscribe from €7/mo · Cancel anytime
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <div className="premium-card relative overflow-hidden p-6 shadow-2xl shadow-primary/5">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  Dashboard preview
                </span>
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
                  Live
                </span>
              </div>

              <div className="grid gap-3">
                {previewCards.map((card, i) => (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.1 }}
                    whileHover={reduce ? undefined : { scale: 1.02 }}
                    className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <card.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                      <p className="font-semibold">{card.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                animate={reduce ? undefined : { y: [0, -4, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center text-sm"
              >
                <span className="font-semibold text-primary">AI insight:</span>{" "}
                You&apos;re 12g under protein today — try Greek yogurt at dinner.
              </motion.div>
            </div>
          </div>

          <motion.div
            className="absolute -bottom-4 -left-4 hidden rounded-xl border border-border bg-card px-4 py-3 shadow-lg sm:block"
            animate={reduce ? undefined : { y: [0, 6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <p className="text-xs text-muted-foreground">Live coaching</p>
            <p className="font-bold">HIIT · Tonight 7PM</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
