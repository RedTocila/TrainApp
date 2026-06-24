"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { ClientIntakeInfo } from "@/lib/actions/client-intake";
import { formatGender } from "@/lib/intake-display";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export function ClientInformationDialog({
  open,
  onClose,
  intake,
  preferences,
}: {
  open: boolean;
  onClose: () => void;
  intake: ClientIntakeInfo | null;
  preferences?: string | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !intake) return null;

  const { profile, latestWeightKg, goalLabel } = intake;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Client information"
        className="relative z-10 flex max-h-[min(90vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-black">Client information</h2>
            <p className="text-sm text-muted-foreground">{profile.full_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Field label="Age" value={profile.age ? `${profile.age} years` : null} />
          <Field label="Gender" value={formatGender(profile.gender)} />
          <Field label="Goal" value={goalLabel} />
          <Field
            label="Weight"
            value={latestWeightKg ? `${latestWeightKg} kg` : null}
          />
          <Field
            label="Height"
            value={profile.height_cm ? `${profile.height_cm} cm` : null}
          />
          <Field label="Vices" value={profile.vices} />
          <Field label="Injuries" value={profile.injuries} />
          <Field label="Medical conditions" value={profile.medical_conditions} />
          <Field label="Daily routine" value={profile.daily_routine} />
          <Field label="Work schedule" value={profile.work_schedule} />
          {preferences && (
            <Field label="Plan request notes" value={preferences} />
          )}
          {!goalLabel &&
            !profile.age &&
            !formatGender(profile.gender) &&
            !latestWeightKg &&
            !profile.height_cm &&
            !profile.vices &&
            !profile.injuries &&
            !profile.medical_conditions &&
            !profile.daily_routine &&
            !profile.work_schedule &&
            !preferences && (
              <p className="text-sm text-muted-foreground">
                No intake information yet. Ask the client to fill in their profile health
                details or nutrition plan request.
              </p>
            )}
        </div>
      </div>
    </div>
  );
}
