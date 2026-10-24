"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IntakeQuestionnaireWizard } from "@/components/intake-questionnaire-wizard";
import {
  EMPTY_INTAKE_RESPONSES,
  type IntakeResponses,
} from "@/lib/intake-questionnaire";
import { loadIntakeDraft, saveIntakeDraft } from "@/lib/intake-storage";
import { createClient } from "@/lib/supabase/client";
import { IOS_GENERATING_PATH, IOS_WELCOME_PATH } from "@/lib/ios-routes";

/**
 * Same questionnaire as web get-started, wrapped in dark/red funnel chrome.
 * Signed-in users finish their intake here. New accounts register inside the app.
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
      // Routing hint only (local session read) — the server re-checks auth.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        router.push(IOS_GENERATING_PATH);
        return;
      }
    } catch {
      // No session yet — continue to free registration in the app.
    }

    router.push("/register?from=ios");
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <IntakeQuestionnaireWizard
        initialResponses={responses}
        onComplete={(completed) => {
          void handleComplete(completed);
        }}
        onExit={() => router.push(IOS_WELCOME_PATH)}
        completeLabel="Continue"
        locked={finishing}
        status={finishing ? "Saving your profile. Your workout is built next." : null}
      />
    </div>
  );
}
