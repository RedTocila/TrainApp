"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, Sparkles } from "lucide-react";
import {
  IntakeQuestionnaireWizard,
} from "@/components/intake-questionnaire-wizard";
import { updateClientIntakeFromResponses } from "@/lib/actions/client-intake";
import {
  getMissingIntakeResponses,
  isIntakeResponsesComplete,
  profileToResponses,
  type IntakeResponses,
} from "@/lib/intake-questionnaire";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function ClientIntakeForm({ profile }: { profile: Profile }) {
  const initial = profileToResponses(profile);
  const complete = isIntakeResponsesComplete(initial);
  const missingFields = getMissingIntakeResponses(initial);
  const [open, setOpen] = useState(!complete);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [macroMessage, setMacroMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!complete) setOpen(true);
  }, [complete]);

  const handleComplete = (responses: IntakeResponses) => {
    setError(null);
    setSuccess(false);
    setMacroMessage(null);
    startTransition(async () => {
      const result = await updateClientIntakeFromResponses(responses);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setEditing(false);
        if (result.macrosUpdated && result.macros) {
          const prefix =
            result.macroSource === "ai" ? "AI-personalized targets" : "Estimated targets";
          const rationale =
            result.macroRationale && result.macroSource === "ai"
              ? ` — ${result.macroRationale}`
              : "";
          setMacroMessage(
            `${prefix}: ${result.macros.calories} cal · P${result.macros.protein} C${result.macros.carbs} F${result.macros.fat}${rationale}`
          );
        }
      router.refresh();
    });
  };

  return (
    <Card
      className={cn(!complete && "border-red-500/40 bg-red-500/[0.03]")}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 p-5 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Health & lifestyle</span>
            {complete ? (
              <Badge className="bg-green-500/15 text-green-400">Complete</Badge>
            ) : (
              <Badge className="bg-red-500/15 text-red-400">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Incomplete
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {complete
              ? "Your personalized plan uses this profile for macros, habits, and AI coaching."
              : `${missingFields.length} areas left — ${missingFields.slice(0, 3).join(", ")}${missingFields.length > 3 ? "…" : ""}`}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <CardContent className="border-t border-border pt-0">
          <div className="space-y-4 pt-4">
            {complete && !editing ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Profile locked in. Update anytime if your routine or goals change.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(true)}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Update questionnaire
                </Button>
              </div>
            ) : (
              <IntakeQuestionnaireWizard
                compact
                completeLabel="Save health profile"
                initialResponses={initial}
                onComplete={handleComplete}
              />
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-green-400">Saved</p>}
            {macroMessage && (
              <p className="text-sm text-primary">{macroMessage}</p>
            )}
            {isPending && (
              <p className="text-sm text-muted-foreground">Saving your profile…</p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
