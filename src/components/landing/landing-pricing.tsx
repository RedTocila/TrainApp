"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { CUSTOM_PLAN_PRODUCTS, TRAINER_NAME } from "@/lib/custom-plan-products";
import {
  SUBSCRIPTION_PLANS,
  type BillingInterval,
} from "@/lib/subscription-plans";
import { FadeIn } from "@/components/landing/landing-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function annualSavings(monthlyCents: number, annualCents: number): string | null {
  const saved = monthlyCents * 12 - annualCents;
  if (saved <= 0) return null;
  return `Save €${(saved / 100).toFixed(0)}/year`;
}

export function LandingPricing() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  return (
    <section id="pricing" className="scroll-mt-24 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-16">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Simple, transparent plans
          </h2>
          <p className="mt-4 text-muted-foreground">
            Explore the dashboard for free. Subscribe when you&apos;re ready to
            log workouts, meals, habits, and unlock AI features.
          </p>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="flex justify-center">
            <div className="inline-flex rounded-lg border border-border bg-secondary/50 p-1">
              {(["monthly", "annual"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setInterval(key)}
                  className={cn(
                    "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                    interval === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {key === "monthly" ? "Monthly" : "Annual"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {SUBSCRIPTION_PLANS.map((plan, i) => {
              const price = interval === "monthly" ? plan.monthly : plan.annual;
              const savings =
                interval === "annual"
                  ? annualSavings(plan.monthly.amountCents, plan.annual.amountCents)
                  : null;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.45 }}
                  whileHover={{ y: -4 }}
                >
                  <Card
                    className={cn(
                      "relative h-full overflow-hidden",
                      plan.highlighted && "border-primary/50 shadow-lg shadow-primary/10"
                    )}
                  >
                    {plan.badge && (
                      <div className="absolute right-4 top-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                          <Sparkles className="h-3 w-3" />
                          {plan.badge}
                        </span>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                      <div className="pt-2">
                        <span className="text-4xl font-black">{price.label}</span>
                        <span className="text-muted-foreground">
                          /{interval === "monthly" ? "mo" : "yr"}
                        </span>
                        {savings && (
                          <p className="mt-1 text-sm font-medium text-green-400">
                            {savings}
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <ul className="space-y-2">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Link href="/register">
                        <Button
                          className="w-full"
                          variant={plan.highlighted ? "default" : "outline"}
                        >
                          Get started
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </FadeIn>

        <FadeIn>
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold">One-time custom plans</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Hand-built by {TRAINER_NAME} — delivered in-app, ready to implement
                on your calendar.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {CUSTOM_PLAN_PRODUCTS.map((product) => (
                <motion.div
                  key={product.type}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-lg">{product.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {product.description}
                      </p>
                      <p className="pt-2 text-3xl font-black">{product.label}</p>
                    </CardHeader>
                    <CardContent>
                      <Link href="/register">
                        <Button variant="outline" className="w-full">
                          Sign up to order
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
