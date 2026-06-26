"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { applyPendingIntakeDraft } from "@/lib/actions/client-intake";
import { clearIntakeDraft, loadIntakeDraft } from "@/lib/intake-storage";
import { isIntakeResponsesComplete } from "@/lib/intake-questionnaire";

export function PendingIntakeSync({ intakeComplete }: { intakeComplete: boolean }) {
  const router = useRouter();
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current) return;

    if (intakeComplete) {
      clearIntakeDraft();
      return;
    }

    const draft = loadIntakeDraft();
    if (!draft || !isIntakeResponsesComplete(draft)) return;

    synced.current = true;

    void applyPendingIntakeDraft(JSON.stringify(draft)).then((result) => {
      if (result && "success" in result && result.success) {
        clearIntakeDraft();
        router.refresh();
      }
    });
  }, [intakeComplete, router]);

  return null;
}
