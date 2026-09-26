"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BrandWordmark } from "@/components/app-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IOS_ONBOARDING_PATH } from "@/lib/ios-routes";

/**
 * Native-only welcome — original composition (dots, red/zinc blooms, dark black).
 * Atmosphere comes from IosFunnelShell; this is the content layer only.
 */
export function IosWelcomeClient() {
  return (
    <div className="relative flex min-h-[calc(100dvh-2rem)] flex-col px-6">
      <div className="relative flex flex-1 flex-col justify-between">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="pt-8"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
            RUTINA
          </p>
          <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-zinc-50 sm:text-5xl">
            Your AI
            <br />
            Fitness Coach
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-zinc-400">
            Personalized workouts, nutrition and guidance built around you.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-3 pb-4"
        >
          <div className="mb-6 flex justify-center">
            <BrandWordmark className="text-2xl" />
          </div>
          <Link
            href={IOS_ONBOARDING_PATH}
            className={cn(
              buttonVariants({ variant: "default" }),
              "h-12 w-full rounded-xl bg-red-600 text-base font-semibold text-white hover:bg-red-500"
            )}
          >
            Get Started
          </Link>
          <Link
            href="/login?from=ios&next=%2Fdashboard"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-12 w-full rounded-xl text-base font-medium text-zinc-300 hover:bg-zinc-800/80 hover:text-white"
            )}
          >
            I already have an account
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
