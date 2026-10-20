"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  IntakeCompleteSummary,
  IntakeQuestionnaireWizard,
} from "@/components/intake-questionnaire-wizard";
import { AppLogo } from "@/components/app-logo";
import { AuthBackButton } from "@/components/auth-back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useIsNativeApp } from "@/components/ios/use-native-app";
import { openWebsiteSignup } from "@/lib/open-external-url";
import { calculateMacrosFromIntakeResponses } from "@/lib/macro-calculator";
import {
  EMPTY_INTAKE_RESPONSES,
  type IntakeResponses,
} from "@/lib/intake-questionnaire";
import { IOS_WELCOME_PATH } from "@/lib/ios-routes";
import { saveIntakeDraft, loadIntakeDraft, clearIntakeDraft } from "@/lib/intake-storage";

type Phase = "wizard" | "complete";

export function GetStartedClient() {
  const router = useRouter();
  const nativeApp = useIsNativeApp();
  const registerHref = "/register";
  const [phase, setPhase] = useState<Phase>("wizard");
  const [responses, setResponses] = useState<IntakeResponses>(
    () => loadIntakeDraft() ?? EMPTY_INTAKE_RESPONSES
  );

  const handleComplete = (completed: IntakeResponses) => {
    setResponses(completed);
    saveIntakeDraft(completed);
    setPhase("complete");
  };

  const previewMacros = calculateMacrosFromIntakeResponses(responses);

  const continueToRegister = () => {
    if (nativeApp) {
      void openWebsiteSignup();
      return;
    }
    router.push(registerHref);
  };

  const handleSkipQuestionnaire = () => {
    clearIntakeDraft();
    continueToRegister();
  };

  if (phase === "wizard") {
    return (
      <div className="flex h-dvh flex-col overflow-hidden pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-[max(0.25rem,env(safe-area-inset-top))]">
        <IntakeQuestionnaireWizard
          initialResponses={responses}
          onComplete={handleComplete}
          onExit={() => router.push(nativeApp ? IOS_WELCOME_PATH : "/")}
          secondaryAction={{
            label: "Skip for now",
            onClick: handleSkipQuestionnaire,
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh px-4 pb-[max(1.5rem,var(--safe-area-bottom-inset))] pt-[max(1.5rem,var(--safe-area-top-inset))] sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-20 bottom-20 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AuthBackButton href="/" />
            <Link href="/" className="inline-flex">
              <AppLogo />
            </Link>
          </div>
        </header>

        {phase === "complete" && (
          <Card className="border-primary/30 bg-card/95 shadow-xl backdrop-blur">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <p className="text-center text-xs font-semibold uppercase tracking-wider text-primary">
                Step 2 — Create account
              </p>
              <IntakeCompleteSummary
                responses={responses}
                macros={previewMacros}
              />
              {nativeApp ? (
                <Button size="lg" className="w-full gap-2" onClick={continueToRegister}>
                  Continue on the website
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Link href={registerHref}>
                  <Button size="lg" className="w-full gap-2">
                    Continue to sign up
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
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
