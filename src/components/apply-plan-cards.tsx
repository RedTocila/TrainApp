"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Dumbbell, Salad } from "lucide-react";
import { createPlanRequest } from "@/lib/actions/requests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { PlanRequest } from "@/lib/types";

export function ApplyPlanCards({
  requests,
  needsWorkout,
  needsDiet,
}: {
  requests: PlanRequest[];
  needsWorkout: boolean;
  needsDiet: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const workoutRequest = requests.find((r) => r.type === "workout");
  const dietRequest = requests.find((r) => r.type === "diet");

  const handleApply = (type: "workout" | "diet") => {
    setError(null);
    startTransition(async () => {
      const result = await createPlanRequest(type, notes || undefined);
      if (result.error) setError(result.error);
    });
  };

  if (!needsWorkout && !needsDiet) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle>Get Your Personalized Plan</CardTitle>
          <CardDescription>
            Apply for a custom plan built by your coach. You&apos;ll be notified when it&apos;s ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Tell your coach about your goals (optional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {needsWorkout && (
              workoutRequest ? (
                <PendingCard type="workout" status={workoutRequest.status} />
              ) : (
                <Button
                  onClick={() => handleApply("workout")}
                  disabled={isPending}
                  className="h-auto flex-col gap-2 py-4"
                >
                  <Dumbbell className="h-6 w-6" />
                  Apply for Workout Plan
                </Button>
              )
            )}
            {needsDiet && (
              dietRequest ? (
                <PendingCard type="diet" status={dietRequest.status} />
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => handleApply("diet")}
                  disabled={isPending}
                  className="h-auto flex-col gap-2 py-4"
                >
                  <Salad className="h-6 w-6" />
                  Apply for Diet Plan
                </Button>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PendingCard({
  type,
  status,
}: {
  type: "workout" | "diet";
  status: string;
}) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 text-center">
      <p className="font-semibold capitalize">{type} Plan</p>
      <p className="mt-1 text-sm text-amber-400">
        {status === "pending"
          ? "Pending — your coach is reviewing"
          : "In progress — your coach is building your plan"}
      </p>
    </div>
  );
}
