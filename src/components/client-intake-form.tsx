"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { updateClientIntake } from "@/lib/actions/client-intake";
import {
  getMissingIntakeFields,
  isClientIntakeComplete,
} from "@/lib/client-intake-utils";
import { GENDER_OPTIONS } from "@/lib/intake-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

const GOAL_OPTIONS = [
  { value: "", label: "No goal set" },
  { value: "lose_weight", label: "Lose weight" },
  { value: "build_muscle", label: "Build muscle" },
  { value: "stay_fit", label: "Stay fit" },
  { value: "improve_endurance", label: "Improve endurance" },
  { value: "general_health", label: "General health" },
];

export function ClientIntakeForm({ profile }: { profile: Profile }) {
  const complete = isClientIntakeComplete(profile);
  const missingFields = getMissingIntakeFields(profile);
  const [open, setOpen] = useState(!complete);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateClientIntake(formData);
      if (result?.error) setError(result.error);
      else {
        setSuccess(true);
        router.refresh();
      }
    });
  };

  return (
    <Card
      className={cn(
        !complete && "border-red-500/40 bg-red-500/[0.03]"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 p-5 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Health & lifestyle info</span>
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
              ? "Used by your trainer and AI Coach for personalized plans."
              : `Missing: ${missingFields.join(", ")}`}
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
          <form action={handleSubmit} className="space-y-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  name="age"
                  type="number"
                  min={13}
                  max={120}
                  placeholder="e.g. 28"
                  defaultValue={profile.age ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  name="gender"
                  defaultValue={profile.gender ?? ""}
                  className="flex h-10 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
                >
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt.value || "empty"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="intake_weight_kg">Weight (kg)</Label>
                <Input
                  id="intake_weight_kg"
                  name="intake_weight_kg"
                  type="number"
                  step="0.1"
                  defaultValue={profile.intake_weight_kg ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height_cm">Height (cm)</Label>
                <Input
                  id="height_cm"
                  name="height_cm"
                  type="number"
                  defaultValue={profile.height_cm ?? ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal">Goal</Label>
              <select
                id="goal"
                name="goal"
                defaultValue={profile.goal ?? ""}
                className="flex h-10 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
              >
                {GOAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vices">Vices (smoking, alcohol, etc.)</Label>
              <Textarea id="vices" name="vices" rows={2} defaultValue={profile.vices ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="injuries">Injuries</Label>
              <Textarea id="injuries" name="injuries" rows={2} defaultValue={profile.injuries ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medical_conditions">Medical conditions</Label>
              <Textarea
                id="medical_conditions"
                name="medical_conditions"
                rows={2}
                defaultValue={profile.medical_conditions ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily_routine">Daily routine</Label>
              <Textarea
                id="daily_routine"
                name="daily_routine"
                rows={3}
                placeholder="Wake time, training time, sleep, etc."
                defaultValue={profile.daily_routine ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work_schedule">Work schedule</Label>
              <Textarea
                id="work_schedule"
                name="work_schedule"
                rows={2}
                placeholder="Hours, shifts, desk job vs active, etc."
                defaultValue={profile.work_schedule ?? ""}
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-green-400">Saved</p>}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save health info"}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
