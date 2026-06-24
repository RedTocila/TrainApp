"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { LANDING_STATS } from "@/lib/landing-content";
import { FadeIn } from "@/components/landing/landing-motion";
import { Button } from "@/components/ui/button";

export function LandingCta() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <FadeIn>
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card to-card p-10 text-center sm:p-14">
          <motion.div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
            animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 6, repeat: Infinity }}
          />
          <div className="relative space-y-6">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Ready to train like a champion?
            </h2>
            <p className="mx-auto max-w-lg text-muted-foreground">
              Join LevelUp today. Set up your profile, pick a plan, and start
              building momentum from day one.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Create free account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  I already have an account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
          {LANDING_STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-black text-primary sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}
