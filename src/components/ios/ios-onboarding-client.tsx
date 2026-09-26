"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { IntakeQuestionnaireWizard } from "@/components/intake-questionnaire-wizard";
import { Card, CardContent } from "@/components/ui/card";
import {
  EMPTY_INTAKE_RESPONSES,
  type IntakeResponses,
} from "@/lib/intake-questionnaire";
import { loadIntakeDraft, saveIntakeDraft } from "@/lib/intake-storage";
import { createClient } from "@/lib/supabase/client";
import { IOS_GENERATING_PATH, IOS_WELCOME_PATH } from "@/lib/ios-routes";

/**
 * Same questionnaire as web get-started, wrapped in dark/red funnel chrome.
 * On finish → create account with macros (register), not a separate gateway.
 */
export function IosOnboardingClient() {
  const router = useRouter();
  const [responses, setResponses] = useState<IntakeResponses>(
    () => loadIntakeDraft() ?? EMPTY_INTAKE_RESPONSES
  );
  const [finishing, setFinishing] = useState(false);

  const handleComplete = async (completed: IntakeResponses) => {
    if (finishing) return;
    setFinishing(true);
    setResponses(completed);
    saveIntakeDraft(completed);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        router.push(IOS_GENERATING_PATH);
        return;
      }
    } catch {
      // fall through to register
    }

    router.push("/register?from=ios");
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4">
      <header className="flex items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => router.push(IOS_WELCOME_PATH)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300"
          aria-label="Back to welcome"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500">
            RUTINA
          </p>
          <p className="text-sm text-zinc-400">
            Health & lifestyle questionnaire
          </p>
        </div>
      </header>

      <Card className="border-zinc-800/80 bg-background/95 shadow-xl backdrop-blur">
        <CardContent className="p-4 sm:p-6">
          <IntakeQuestionnaireWizard
            initialResponses={responses}
            onComplete={(completed) => {
              void handleComplete(completed);
            }}
            compact
            completeLabel="Continue to create account"
          />
          {finishing ? (
            <p className="mt-4 text-center text-sm text-zinc-400">
              Preparing your macros…
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
