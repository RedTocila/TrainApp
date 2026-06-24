"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bot, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroGlow } from "@/components/landing/landing-motion";
import {
  GET_STARTED_CTA,
  GET_STARTED_HREF,
  LANDING_HIGHLIGHTS,
} from "@/lib/landing-content";
import {
  MacroBars,
  ProgressRing,
  WeekStrip,
  WeightTrendChart,
} from "@/components/landing/landing-visuals";

export function LandingHero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:pb-24">
      <HeroGlow />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="space-y-6 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI-powered fitness
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Train smarter.
            <span className="block text-primary">See results faster.</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="flex flex-wrap justify-center gap-2 lg:justify-start"
          >
            {LANDING_HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium"
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                {label}
              </span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="flex justify-center lg:justify-start"
          >
            <Link href={GET_STARTED_HREF}>
              <Button size="lg" className="gap-2 px-8">
                {GET_STARTED_CTA}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-sm text-muted-foreground"
          >
            2-min questionnaire · Free to browse · Plans from €7/mo
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-lg"
        >
          <div className="premium-card relative overflow-hidden p-5 shadow-2xl shadow-primary/10 sm:p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-violet-500/5" />
            <div className="relative grid gap-4 sm:grid-cols-2">
              <div className="space-y-4 sm:col-span-2">
                <MacroBars className="rounded-xl border border-border bg-secondary/30 p-4" />
              </div>
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <WeightTrendChart />
              </div>
              <div className="flex items-center justify-center rounded-xl border border-border bg-secondary/30 p-4">
                <ProgressRing value={78} label="Today" sublabel="Goals hit" />
              </div>
              <div className="rounded-xl border border-border bg-secondary/30 p-4 sm:col-span-2">
                <WeekStrip />
              </div>
            </div>
          </div>

          <motion.div
            className="absolute -bottom-3 -right-2 flex items-center gap-2 rounded-xl border border-primary/30 bg-card px-3 py-2 shadow-lg sm:-right-4"
            animate={reduce ? undefined : { y: [0, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">AI insight</p>
              <p className="text-xs font-bold">+12g protein tip</p>
            </div>
          </motion.div>

          <motion.div
            className="absolute -left-2 top-8 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg sm:-left-4"
            animate={reduce ? undefined : { y: [0, 5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Zap className="h-4 w-4 text-amber-400" />
            <p className="text-xs font-bold">HIIT · 7PM tonight</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
