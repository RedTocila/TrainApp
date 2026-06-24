"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Target, Utensils, Zap } from "lucide-react";
import {
  IntakeCompleteSummary,
  IntakeQuestionnaireWizard,
} from "@/components/intake-questionnaire-wizard";
import { AppLogo } from "@/components/app-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { calculateMacrosFromIntakeResponses } from "@/lib/macro-calculator";
import {
  EMPTY_INTAKE_RESPONSES,
  type IntakeResponses,
} from "@/lib/intake-questionnaire";
import { saveIntakeDraft, loadIntakeDraft } from "@/lib/intake-storage";

const perks = [
  { icon: Target, text: "Macro targets tuned to your body & goal" },
  { icon: Utensils, text: "Nutrition that fits how you actually eat" },
  { icon: Zap, text: "Habit ideas matched to your lifestyle" },
];

type Phase = "intro" | "wizard" | "complete";

export function GetStartedClient() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [responses, setResponses] = useState<IntakeResponses>(
    () => loadIntakeDraft() ?? EMPTY_INTAKE_RESPONSES
  );

  const handleComplete = (completed: IntakeResponses) => {
    setResponses(completed);
    saveIntakeDraft(completed);
    setPhase("complete");
  };

  const previewMacros = calculateMacrosFromIntakeResponses(responses);

  return (
    <div className="relative min-h-dvh px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-20 bottom-20 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <Link href="/" className="inline-flex">
            <AppLogo />
          </Link>
          <ThemeToggle />
        </header>

        {phase === "intro" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 py-6 sm:py-10"
          >
            <div className="space-y-4 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                2-minute setup
              </span>
              <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                Get your custom plan
              </h1>
              <p className="mx-auto max-w-md text-muted-foreground">
                Answer a few quick questions about your body, training, work, sleep,
                and nutrition — we&apos;ll personalize macros, habits, and coaching
                before you even sign up.
              </p>
            </div>

            <div className="grid gap-3">
              {perks.map(({ icon: Icon, text }, i) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3 backdrop-blur"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium">{text}</p>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => setPhase("wizard")}
              >
                Build my plan
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Link href="/register">
                <Button size="lg" variant="outline" className="w-full">
                  Skip — sign up first
                </Button>
              </Link>
            </div>
          </motion.div>
        )}

        {phase === "wizard" && (
          <Card className="border-border/80 bg-card/95 shadow-xl backdrop-blur">
            <CardContent className="p-5 sm:p-8">
              <IntakeQuestionnaireWizard
                initialResponses={responses}
                onComplete={handleComplete}
              />
            </CardContent>
          </Card>
        )}

        {phase === "complete" && (
          <Card className="border-primary/30 bg-card/95 shadow-xl backdrop-blur">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <IntakeCompleteSummary
                responses={responses}
                macros={previewMacros}
              />
              <Link href="/register">
                <Button size="lg" className="w-full gap-2">
                  Create account & unlock plan
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setPhase("wizard")}
              >
                Review my answers
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
