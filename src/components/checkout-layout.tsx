"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { SarcasticGiveUpDialog } from "@/components/sarcastic-give-up-dialog";
import { useCoachCopy, usePlatformCopy } from "@/components/locale-provider";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Stepper({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: string[];
}) {
  return (
    <div className="flex items-center gap-3">
      {steps.map((label, idx) => {
        const step = idx + 1;
        const state =
          step < currentStep ? "completed" : step === currentStep ? "current" : "upcoming";

        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <div
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full border text-xs font-bold",
                  state === "completed" && "border-primary/40 bg-primary/15 text-primary",
                  state === "current" && "border-primary bg-primary text-primary-foreground shadow-sm",
                  state === "upcoming" && "border-border bg-secondary/40 text-muted-foreground"
                )}
              >
                {state === "completed" ? <Check className="h-4 w-4" /> : step}
              </div>
              <span
                className={cn(
                  "text-sm font-semibold",
                  state === "upcoming" ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {idx !== steps.length - 1 && (
              <div className="hidden h-px flex-1 bg-border sm:block" aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function CheckoutLayout({
  backHref,
  backLabel,
  title,
  subtitle,
  totalLabel,
  steps,
  currentStep = 2,
  summary,
  payment,
  confirmBack = true,
}: {
  backHref: string;
  backLabel?: string;
  title?: string;
  subtitle?: string;
  totalLabel?: string;
  steps?: string[];
  currentStep?: number;
  summary: React.ReactNode;
  payment: React.ReactNode;
  confirmBack?: boolean;
}) {
  const router = useRouter();
  const platform = usePlatformCopy();
  const coachCopy = useCoachCopy();
  const flow = platform.checkoutFlow;
  const [leaveOpen, setLeaveOpen] = React.useState(false);

  const handleBackClick = () => {
    if (confirmBack) {
      setLeaveOpen(true);
      return;
    }
    router.push(backHref);
  };

  const leaveCopy = coachCopy.checkoutLeave;

  return (
    <div className="premium-gradient">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleBackClick}
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel ?? flow.back}
            </button>
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                {title ?? flow.title}
              </h1>
              {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <Stepper currentStep={currentStep} steps={steps ?? [...flow.steps]} />
            {totalLabel ? (
              <div className="rounded-xl border border-border bg-card/70 px-3 py-2 text-right backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {flow.total}
                </p>
                <p className="text-lg font-black">{totalLabel}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-start">
          <Card className="border-primary/15 bg-card/70 backdrop-blur">
            <CardHeader className="space-y-1">
              <CardTitle>{flow.summaryTitle}</CardTitle>
              <p className="text-sm text-muted-foreground">{flow.summarySubtitle}</p>
            </CardHeader>
            <CardContent className="space-y-4">{summary}</CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-card">
            <CardHeader className="space-y-1">
              <CardTitle>{flow.finalizeTitle}</CardTitle>
              <p className="text-sm text-muted-foreground">{flow.finalizeSubtitle}</p>
            </CardHeader>
            <CardContent className="space-y-4">{payment}</CardContent>
          </Card>
        </div>
      </div>

      <SarcasticGiveUpDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onConfirm={() => router.push(backHref)}
        title={leaveCopy.title}
        message={leaveCopy.message}
        confirmLabel={leaveCopy.confirm}
        cancelLabel={leaveCopy.cancel}
      />
    </div>
  );
}
