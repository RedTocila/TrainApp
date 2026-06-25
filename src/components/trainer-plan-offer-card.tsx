"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Dumbbell, Salad, X } from "lucide-react";
import {
  createCustomPlanCheckout,
  implementTrainerPlan,
  removeTrainerPlanImplementation,
} from "@/lib/actions/custom-plans";
import {
  CheckoutCurrencyToggle,
  CheckoutLocaleToggle,
} from "@/components/checkout-preferences-toggle";
import { NutritionPlanPdfViewer } from "@/components/nutrition-plan-pdf-viewer";
import {
  CUSTOM_PLAN_PRODUCTS,
  getCustomPlanPrice,
  TRAINER_NAME,
} from "@/lib/custom-plan-products";
import {
  DEFAULT_CHECKOUT_CURRENCY,
  DEFAULT_CHECKOUT_LOCALE,
  type CheckoutCurrency,
  type CheckoutLocale,
} from "@/lib/checkout-i18n";
import type { PlanRequest, PlanRequestType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function planLabel(type: PlanRequestType) {
  return type === "workout" ? "Custom workout plan" : "Custom nutrition plan";
}

function customPlanButtonLabel(type: PlanRequestType, priceLabel: string) {
  return type === "workout"
    ? `Custom workout ${priceLabel}`
    : `Custom nutrition ${priceLabel}`;
}

function statusMessage(request: PlanRequest): string {
  switch (request.status) {
    case "awaiting_approval":
      return `Waiting for trainer ${TRAINER_NAME} to accept your proposal. If not accepted, your payment will be refunded.`;
    case "rejected":
      return "Your proposal was not accepted. Your payment will be refunded.";
    case "in_progress":
      return `${TRAINER_NAME} is building your custom plan.`;
    case "delivered":
      return request.type === "diet"
        ? `Your nutrition plan PDF from ${TRAINER_NAME} is ready. View it below.`
        : `Your plan from ${TRAINER_NAME} is ready. Click Implement it to add to your calendar.`;
    case "implemented":
      return request.type === "diet" && request.delivered_nutrition_pdf_path
        ? `Your nutrition plan PDF is available below.`
        : `Your plan is live on your calendar. Previous coach plan was replaced.`;
    default:
      return "Request in progress.";
  }
}

function isNutritionPdfPlan(request: PlanRequest) {
  return request.type === "diet" && !!request.delivered_nutrition_pdf_path;
}

function findPlanRequest(requests: PlanRequest[], type: PlanRequestType) {
  const statuses = [
    "awaiting_approval",
    "in_progress",
    "delivered",
    "implemented",
    "pending",
  ] as const;

  return (
    requests
      .filter((r) => r.type === type && statuses.includes(r.status as (typeof statuses)[number]))
      .sort(
        (a, b) =>
          new Date(b.implemented_at ?? b.delivered_at ?? b.created_at).getTime() -
          new Date(a.implemented_at ?? a.delivered_at ?? a.created_at).getTime()
      )[0] ?? null
  );
}

function CustomPlanDialog({
  open,
  onClose,
  type,
  request: initialRequest,
  onImplemented,
  onRemoved,
}: {
  open: boolean;
  onClose: () => void;
  type: PlanRequestType;
  request: PlanRequest | null;
  onImplemented?: (request: PlanRequest, planTitle: string) => void;
  onRemoved?: (request: PlanRequest) => void;
}) {
  const router = useRouter();
  const product = CUSTOM_PLAN_PRODUCTS.find((p) => p.type === type)!;
  const [request, setRequest] = useState<PlanRequest | null>(initialRequest);
  const [preferences, setPreferences] = useState("");
  const [currency, setCurrency] = useState<CheckoutCurrency>(DEFAULT_CHECKOUT_CURRENCY);
  const [locale, setLocale] = useState<CheckoutLocale>(DEFAULT_CHECKOUT_LOCALE);
  const [error, setError] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const Icon = type === "workout" ? Dumbbell : Salad;

  useEffect(() => {
    if (!open) return;
    setRequest(initialRequest);
    setPreferences(initialRequest?.preferences ?? initialRequest?.notes ?? "");
    setError(null);
    if (initialRequest?.status !== "implemented") {
      setSuccessTitle(null);
    }
  }, [open, initialRequest]);

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

  const price = getCustomPlanPrice(type, currency);

  const handleCheckout = () => {
    setError(null);
    startTransition(async () => {
      const result = await createCustomPlanCheckout(type, preferences, currency);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("localOrderId" in result && result.localOrderId) {
        window.location.href = `/dashboard/checkout/custom?localOrderId=${result.localOrderId}&type=${type}&locale=${locale}`;
      }
    });
  };

  const handleImplement = () => {
    if (!request) return;
    setError(null);
    startTransition(async () => {
      const result = await implementTrainerPlan(request.id);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (!("success" in result) || !result.success) return;

      const implementedRequest: PlanRequest = {
        ...request,
        status: "implemented",
        implemented_at: new Date().toISOString(),
      };
      setRequest(implementedRequest);
      setSuccessTitle(result.planTitle);
      onImplemented?.(implementedRequest, result.planTitle);
      router.refresh();
    });
  };

  const handleRemoveFromCalendar = () => {
    if (!request) return;
    if (
      !confirm(
        "Remove this plan from your calendar? You can implement it again later if you change your mind."
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await removeTrainerPlanImplementation(request.id);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      const deliveredRequest: PlanRequest = {
        ...request,
        status: "delivered",
        implemented_at: null,
      };
      setRequest(deliveredRequest);
      setSuccessTitle(null);
      onRemoved?.(deliveredRequest);
      router.refresh();
    });
  };

  if (!open) return null;

  const showOffer = !request || request.status === "rejected";
  const showSuccess =
    request?.status === "implemented" && request && !isNutritionPdfPlan(request);
  const showPdf =
    request &&
    isNutritionPdfPlan(request) &&
    ["delivered", "implemented", "completed"].includes(request.status);

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
        aria-label={planLabel(type)}
        className="relative z-10 flex max-h-[min(90vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 pr-4">
            <Icon className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="font-bold">{planLabel(type)}</h2>
              <p className="text-sm text-muted-foreground">by {TRAINER_NAME}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {showPdf ? (
            <>
              <Badge variant="outline" className="capitalize">
                {request!.status === "delivered" ? "Ready" : request!.status.replace(/_/g, " ")}
              </Badge>
              <p className="text-sm text-muted-foreground">{statusMessage(request!)}</p>
              <NutritionPlanPdfViewer requestId={request!.id} />
              {error && <p className="text-sm text-red-400">{error}</p>}
            </>
          ) : showSuccess ? (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-green-500/40 bg-green-500/15">
                <Check className="h-7 w-7 text-green-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-green-400">Implemented & confirmed</p>
                <p className="mt-2 text-sm font-medium">{successTitle ?? planLabel(type)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {type === "diet"
                    ? "Your new nutrition plan is on your calendar. Previous meals were replaced with your coach schedule."
                    : "Your new workout plan is active. It replaced your previous coach workout plan."}
                </p>
              </div>
              <Badge className="bg-green-500/15 text-green-400">On your calendar</Badge>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          ) : showOffer ? (
            <>
              <p className="text-sm text-muted-foreground">{product.description}</p>
              <div className="space-y-3">
                <CheckoutCurrencyToggle currency={currency} onCurrencyChange={setCurrency} />
                <CheckoutLocaleToggle locale={locale} onLocaleChange={setLocale} />
              </div>
              <p className="text-2xl font-black">
                {price.label}
                <span className="text-sm font-normal text-muted-foreground"> one-time</span>
              </p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>· Tell us your goals and preferences</li>
                <li>· {TRAINER_NAME} reviews and builds your plan</li>
                <li>
                  ·{" "}
                  {type === "diet"
                    ? "Receive your plan as a PDF in the app"
                    : "Implement it on your calendar when ready"}
                </li>
              </ul>
              {type === "diet" && (
                <p className="text-xs text-muted-foreground">
                  Fill in{" "}
                  <a href="/dashboard/profile" className="text-primary hover:underline">
                    Profile → Health & lifestyle info
                  </a>{" "}
                  so your trainer has weight, height, injuries, routine, and work details.
                </p>
              )}
              <Textarea
                placeholder="Your goals, experience level, schedule, injuries, food preferences…"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                rows={4}
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
            </>
          ) : (
            <>
              <Badge variant="outline" className="capitalize">
                {request!.status.replace(/_/g, " ")}
              </Badge>
              <p className="text-sm text-muted-foreground">{statusMessage(request!)}</p>
              {(request!.preferences || request!.notes) && (
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Your preferences</p>
                  <p className="text-sm">{request!.preferences ?? request!.notes}</p>
                </div>
              )}
              {error && <p className="text-sm text-red-400">{error}</p>}
            </>
          )}
        </div>

        <div className="border-t border-border px-5 py-4">
          {showPdf ? (
            <Button onClick={onClose} className="w-full">
              Close
            </Button>
          ) : showSuccess ? (
            <div className="space-y-2">
              <Button onClick={onClose} className="w-full">
                Done
              </Button>
              <Button
                variant="outline"
                onClick={handleRemoveFromCalendar}
                disabled={isPending}
                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
              >
                {isPending ? "Removing…" : "Remove from calendar"}
              </Button>
            </div>
          ) : showOffer ? (
            <Button onClick={handleCheckout} disabled={isPending} className="w-full">
              Continue to payment
            </Button>
          ) : request!.status === "delivered" && request!.type === "workout" ? (
            <Button onClick={handleImplement} disabled={isPending} className="w-full">
              {isPending ? "Implementing…" : "Implement it"}
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CustomPlanButton({
  type,
  requests,
}: {
  type: PlanRequestType;
  requests: PlanRequest[];
}) {
  const [open, setOpen] = useState(false);
  const [requestOverride, setRequestOverride] = useState<PlanRequest | null>(null);
  const product = CUSTOM_PLAN_PRODUCTS.find((p) => p.type === type)!;
  const defaultPrice = getCustomPlanPrice(type, DEFAULT_CHECKOUT_CURRENCY);

  const active = requestOverride ?? findPlanRequest(requests, type);

  useEffect(() => {
    setRequestOverride(null);
  }, [requests]);

  const isImplemented =
    active?.status === "implemented" && active && !isNutritionPdfPlan(active);
  const hasPdfReady =
    active &&
    isNutritionPdfPlan(active) &&
    ["delivered", "implemented", "completed"].includes(active.status);
  const showPendingStatus =
    active &&
    !isImplemented &&
    active.status !== "rejected";

  const statusLabel =
    active?.status === "delivered"
      ? active.type === "diet" && active.delivered_nutrition_pdf_path
        ? "PDF ready"
        : "Ready"
      : active?.status.replace(/_/g, " ") ?? null;

  return (
    <>
      <Button
        type="button"
        variant={isImplemented ? "default" : "outline"}
        onClick={() => setOpen(true)}
        aria-label={planLabel(type)}
        className={cn(
          (isImplemented || hasPdfReady) &&
            "border-green-500/40 bg-green-500/10 text-green-400"
        )}
      >
        {isImplemented ? (
          <>
            <Check className="mr-1.5 h-4 w-4" />
            Implemented
          </>
        ) : hasPdfReady ? (
          <>
            <Check className="mr-1.5 h-4 w-4" />
            View plan
          </>
        ) : (
          customPlanButtonLabel(type, defaultPrice.label)
        )}
        {showPendingStatus && statusLabel && (
          <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-400">
            {statusLabel}
          </span>
        )}
      </Button>

      <CustomPlanDialog
        open={open}
        onClose={() => setOpen(false)}
        type={type}
        request={active}
        onImplemented={(req) => setRequestOverride(req)}
        onRemoved={(req) => setRequestOverride(req)}
      />
    </>
  );
}

export function TrainerPlanSection({
  type,
  requests,
}: {
  type: PlanRequestType;
  requests: PlanRequest[];
}) {
  const [open, setOpen] = useState(false);

  const active = findPlanRequest(requests, type);

  const showStatus =
    active &&
    active.status !== "rejected" &&
    active.status !== "implemented";

  const badgeVariant =
    active?.status === "delivered"
      ? ("default" as const)
      : ("warning" as const);

  const badgeLabel = active
    ? active.status === "delivered"
      ? "Ready"
      : active.status.replace(/_/g, " ")
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-secondary/50"
        )}
      >
        <span className="text-sm font-medium">{planLabel(type)}</span>
        <span className="flex items-center gap-2">
          {showStatus && (
            <Badge variant={badgeVariant} className="capitalize">
              {badgeLabel}
            </Badge>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </span>
      </button>

      <CustomPlanDialog
        open={open}
        onClose={() => setOpen(false)}
        type={type}
        request={active ?? null}
      />
    </>
  );
}
