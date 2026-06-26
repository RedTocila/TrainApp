"use client";
import { useCoachCopy, useCoachLabels, usePlatformCopy } from "@/components/locale-provider";

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
} from "@/components/checkout-preferences-toggle";
import { NutritionPlanPdfViewer } from "@/components/nutrition-plan-pdf-viewer";
import { SarcasticGiveUpDialog } from "@/components/sarcastic-give-up-dialog";
import {
  CUSTOM_PLAN_PRODUCTS,
  getCustomPlanPrice,
  TRAINER_NAME,
} from "@/lib/custom-plan-products";
import {
  DEFAULT_CHECKOUT_CURRENCY,
  type CheckoutCurrency,
} from "@/lib/checkout-i18n";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import type { PlanRequest, PlanRequestType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlatformCopy } from "@/lib/platform-copy";

function planLabel(type: PlanRequestType, platform: PlatformCopy) {
  return type === "workout" ? platform.trainer.customWorkout : platform.trainer.customNutrition;
}

function customPlanButtonLabel(
  type: PlanRequestType,
  priceLabel: string,
  platform: PlatformCopy
) {
  return type === "workout"
    ? `${platform.trainer.customWorkout} ${priceLabel}`
    : `${platform.trainer.customNutrition} ${priceLabel}`;
}

function statusMessage(request: PlanRequest, platform: PlatformCopy): string {
  switch (request.status) {
    case "awaiting_approval":
      return platform.trainer.awaitingApproval;
    case "rejected":
      return platform.trainer.proposalRejected;
    case "in_progress":
      return platform.trainer.trainerBuilding;
    case "delivered":
      return platform.trainer.planDelivered;
    case "implemented":
      return request.type === "diet" && request.delivered_nutrition_pdf_path
        ? platform.trainer.planDelivered
        : platform.trainer.planImplemented;
    default:
      return platform.trainer.requestInProgress;
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
  const coachCopy = useCoachCopy();
  const coachLabels = useCoachLabels();
  const platform = usePlatformCopy();
  const router = useRouter();
  const product = CUSTOM_PLAN_PRODUCTS.find((p) => p.type === type)!;
  const [request, setRequest] = useState<PlanRequest | null>(initialRequest);
  const [preferences, setPreferences] = useState("");
  const [currency, setCurrency] = useState<CheckoutCurrency>(DEFAULT_CHECKOUT_CURRENCY);
  const [error, setError] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState<string | null>(null);
  const [giveUpOpen, setGiveUpOpen] = useState(false);
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

  const allPerEur = useExchangeRate();
  const price = getCustomPlanPrice(type, currency, allPerEur);

  const handleCheckout = () => {
    setError(null);
    startTransition(async () => {
      const result = await createCustomPlanCheckout(type, preferences, currency);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("localOrderId" in result && result.localOrderId) {
        window.location.href = `/dashboard/checkout/custom?localOrderId=${result.localOrderId}&type=${type}`;
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
      setGiveUpOpen(false);
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
        aria-label={platform.aria.close}
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={planLabel(type, platform)}
        className="relative z-10 flex max-h-[min(90vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 pr-4">
            <Icon className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="font-bold">{planLabel(type, platform)}</h2>
              <p className="text-sm text-muted-foreground">{platform.trainer.byTrainer(TRAINER_NAME)}</p>
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
                {request!.status === "delivered" ? platform.trainer.ready : request!.status.replace(/_/g, " ")}
              </Badge>
              <p className="text-sm text-muted-foreground">{statusMessage(request!, platform)}</p>
              <NutritionPlanPdfViewer requestId={request!.id} />
              {error && <p className="text-sm text-red-400">{error}</p>}
            </>
          ) : showSuccess ? (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-green-500/40 bg-green-500/15">
                <Check className="h-7 w-7 text-green-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-green-400">{platform.trainer.implementedConfirmed}</p>
                <p className="mt-2 text-sm font-medium">{successTitle ?? planLabel(type, platform)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {type === "diet"
                    ? platform.trainer.nutritionImplemented
                    : platform.trainer.workoutImplemented}
                </p>
              </div>
              <Badge className="bg-green-500/15 text-green-400">{platform.trainer.onCalendar}</Badge>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          ) : showOffer ? (
            <>
              <p className="text-sm text-muted-foreground">{product.description}</p>
              <div className="space-y-3">
                <CheckoutCurrencyToggle currency={currency} onCurrencyChange={setCurrency} />
              </div>
              <p className="text-2xl font-black">
                {price.label}
                <span className="text-sm font-normal text-muted-foreground"> {platform.trainer.oneTime}</span>
              </p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>· Tell us your goals and preferences</li>
                <li>· {TRAINER_NAME} reviews and builds your plan</li>
                <li>
                  ·{" "}
                  {type === "diet"
                    ? platform.trainer.receivePdf
                    : platform.trainer.implementWhenReady}
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
                placeholder={platform.trainer.preferencesPlaceholder}
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
              <p className="text-sm text-muted-foreground">{statusMessage(request!, platform)}</p>
              {(request!.preferences || request!.notes) && (
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{platform.trainer.yourPreferences}</p>
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
              {platform.trainer.close}
            </Button>
          ) : showSuccess ? (
            <div className="space-y-2">
              <Button onClick={onClose} className="w-full">
                {platform.trainer.done}
              </Button>
              <Button
                variant="outline"
                onClick={() => setGiveUpOpen(true)}
                disabled={isPending}
                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
              >
                {coachLabels.giveUpOnThisPlan}
              </Button>
            </div>
          ) : showOffer ? (
            <Button onClick={handleCheckout} disabled={isPending} className="w-full">
              {platform.trainer.continuePayment}
            </Button>
          ) : request!.status === "delivered" && request!.type === "workout" ? (
            <Button onClick={handleImplement} disabled={isPending} className="w-full">
              {isPending ? platform.trainer.implementing : platform.trainer.implementIt}
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose} className="w-full">
              {platform.trainer.close}
            </Button>
          )}
        </div>
      </div>

      <SarcasticGiveUpDialog
        open={giveUpOpen}
        onClose={() => setGiveUpOpen(false)}
        onConfirm={handleRemoveFromCalendar}
        isPending={isPending}
        title={coachCopy.giveUpTrainerPlan.title}
        message={coachCopy.giveUpTrainerPlan.message}
        confirmLabel={coachCopy.giveUpTrainerPlan.confirm}
        cancelLabel={coachCopy.giveUpTrainerPlan.cancel}
      />
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
  const platform = usePlatformCopy();
  const [open, setOpen] = useState(false);
  const [requestOverride, setRequestOverride] = useState<PlanRequest | null>(null);
  const product = CUSTOM_PLAN_PRODUCTS.find((p) => p.type === type)!;
  const allPerEur = useExchangeRate();
  const defaultPrice = getCustomPlanPrice(type, DEFAULT_CHECKOUT_CURRENCY, allPerEur);

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
        ? platform.trainer.pdfReady
        : platform.trainer.ready
      : active?.status.replace(/_/g, " ") ?? null;

  return (
    <>
      <Button
        type="button"
        variant={isImplemented ? "default" : "outline"}
        onClick={() => setOpen(true)}
        aria-label={planLabel(type, platform)}
        className={cn(
          (isImplemented || hasPdfReady) &&
            "border-green-500/40 bg-green-500/10 text-green-400"
        )}
      >
        {isImplemented ? (
          <>
            <Check className="mr-1.5 h-4 w-4" />
            {platform.trainer.implemented}
          </>
        ) : hasPdfReady ? (
          <>
            <Check className="mr-1.5 h-4 w-4" />
            {platform.trainer.viewPlan}
          </>
        ) : (
          customPlanButtonLabel(type, defaultPrice.label, platform)
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
  const platform = usePlatformCopy();
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
      ? platform.trainer.ready
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
        <span className="text-sm font-medium">{planLabel(type, platform)}</span>
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
