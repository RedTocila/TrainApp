"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  FUNNEL_STEPS,
  GET_STARTED_CTA,
  GET_STARTED_HREF,
} from "@/lib/landing-content";
import { FadeIn } from "@/components/landing/landing-motion";
import { FunnelConnector } from "@/components/landing/landing-visuals";
import { Button } from "@/components/ui/button";

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <FadeIn className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            How it works
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Your program in 3 steps
          </h2>
        </FadeIn>

        <FadeIn delay={0.05} className="mt-12">
          <div className="flex flex-col items-stretch gap-6 md:flex-row md:items-center md:justify-center">
            {FUNNEL_STEPS.map((step, i) => (
              <div key={step.step} className="flex flex-col items-center md:flex-row">
                <div className="premium-card flex w-full max-w-xs flex-col items-center p-6 text-center md:w-52">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <step.icon className="h-7 w-7" />
                  </div>
                  <span className="mt-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {step.step}
                  </span>
                  <h3 className="mt-2 font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.subtitle}</p>
                </div>
                {i < FUNNEL_STEPS.length - 1 && <FunnelConnector />}
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.1} className="mt-10 text-center">
          <Link href={GET_STARTED_HREF}>
            <Button size="lg" className="gap-2">
              {GET_STARTED_CTA}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}
