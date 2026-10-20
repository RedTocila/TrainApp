"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Dumbbell,
  Check,
  CheckCircle2,
  Loader2,
  CreditCard,
  ArrowRight,
  TicketPercent,
} from "lucide-react";
import {
  completeGuestCheckoutAndSignIn,
  createGuestCheckoutOrder,
  createGuestAppleCheckoutOrder,
  type GuestSignupPayload,
} from "@/lib/actions/guest-signup";
import { OpenInAppDialog } from "@/components/open-in-app-dialog";
import { isNativeApp } from "@/lib/native-app";
import { completeGuestAppleCheckout } from "@/lib/actions/iap";
import { BrandWordmark } from "@/components/app-logo";
import { AppDialog } from "@/components/app-dialog";
import { AuthCardShell } from "@/components/auth-card-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppleIapCheckout } from "@/components/apple-iap-checkout";
import { PokPayGuestCheckout } from "@/components/pokpay-guest-checkout";
import {
  calculateMacrosFromIntakeResponses,
  type MacroTargets,
} from "@/lib/macro-calculator";
import { loadIntakeDraft, clearIntakeDraft } from "@/lib/intake-storage";
import {
  starterProgramPreview,
  type StarterProgramPreview,
} from "@/lib/intake-starter-program";
import { loadCheckoutReferralCode, saveCheckoutReferralCode } from "@/lib/referral-storage";
import { formatUserError } from "@/lib/format-user-error";
import { cn } from "@/lib/utils";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { getCurrencyPrice } from "@/lib/checkout-i18n";
import type { SubscriptionOffer } from "@/lib/subscription-offers";
import { applyOfferDiscount, pickBestOffer } from "@/lib/subscription-offers";
import { getPlanPrice, type BillingInterval } from "@/lib/subscription-plans";
import { useShouldUseAppleIap } from "@/components/ios/use-native-app";
import { IOS_WELCOME_PATH } from "@/lib/ios-routes";

type PackagePlan = "ai" | "elite";
type SignupDraft = GuestSignupPayload;

const PACKAGE_OPTIONS: Array<{
  id: PackagePlan;
  name: string;
  badge?: string;
}> = [
  {
    id: "ai",
    name: "RUTINA AI Pro",
    badge: "Popular",
  },
  {
    id: "elite",
    name: "RUTINA Elite",
  },
];

function WorkoutPreviewRow({ preview }: { preview: StarterProgramPreview }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
        <Dumbbell className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-sky-200/90">
          Workout program
        </p>
        <p className="text-sm font-semibold leading-snug">
          {preview.daysPerWeek} days/week · {preview.weekdayLabels.join(", ")}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {preview.experience} · {preview.equipment}. {preview.sessions} sessions land on your calendar right after signup.
        </p>
      </div>
    </div>
  );
}

export function RegisterForm({
  initialOffers = [],
}: {
  initialOffers?: SubscriptionOffer[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const platform = usePlatformCopy();
  const useAppleIap = useShouldUseAppleIap();
  const [error, setError] = useState<string | null>(null);
  const [intakeJson, setIntakeJson] = useState<string | null>(null);
  const [macroTargets, setMacroTargets] = useState<MacroTargets | null>(null);
  const [workoutPreview, setWorkoutPreview] = useState<StarterProgramPreview | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PackagePlan>("ai");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [signupDraft, setSignupDraft] = useState<SignupDraft | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [localOrderId, setLocalOrderId] = useState<string | null>(null);
  const [appleProductId, setAppleProductId] = useState<string | null>(null);
  const [appleAccountToken, setAppleAccountToken] = useState<string | null>(null);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [offers] = useState<SubscriptionOffer[]>(initialOffers);
  const [readyEmail, setReadyEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;
    router.replace(IOS_WELCOME_PATH);
  }, [router]);

  useEffect(() => {
    try {
      const draft = loadIntakeDraft();
      if (!draft) return;
      setIntakeJson(JSON.stringify(draft));
      const macros = calculateMacrosFromIntakeResponses(draft);
      if (macros) setMacroTargets(macros);
      setWorkoutPreview(starterProgramPreview(draft));
    } catch {
      // Corrupt local draft must never block account creation.
    }
  }, []);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref?.trim()) {
      const normalized = ref.trim();
      saveCheckoutReferralCode(normalized);
      setReferralCode(normalized);
      return;
    }
    const stored = loadCheckoutReferralCode();
    if (stored?.trim()) setReferralCode(stored.trim());
  }, [searchParams]);

  const finishSignup = (role?: string) => {
    clearIntakeDraft();
    if (role === "admin") {
      router.push("/admin");
      return;
    }
    if (isNativeApp()) {
      router.push("/dashboard");
      return;
    }
    setReadyEmail(signupDraft?.email?.trim() ?? "");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!acceptedTerms) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const fullName = (formData.get("full_name") as string).trim();
      const email = (formData.get("email") as string).trim().toLowerCase();
      const phone = ((formData.get("phone") as string) || "").trim() || null;
      const password = formData.get("password") as string;
      const normalizedReferralCode = referralCode.trim() || null;
      if (normalizedReferralCode) saveCheckoutReferralCode(normalizedReferralCode);

      const nextDraft: SignupDraft = {
        fullName,
        email,
        phone,
        password,
        intakeJson,
        referralCode: normalizedReferralCode,
      };

      setSignupDraft(nextDraft);
    } catch (err) {
      setIsPending(false);
      setError(formatUserError(err, "Could not continue. Please try again."));
    }
  };

  const handleStartCheckout = async () => {
    if (!signupDraft) {
      setError("Please complete signup details first.");
      return;
    }

    setIsPending(true);
    setError(null);
    try {
      if (useAppleIap) {
        const result = await createGuestAppleCheckoutOrder(
          signupDraft,
          selectedPlan,
          billingInterval
        );
        if ("error" in result) {
          setError(result.error ?? "Could not start checkout. Please try again.");
          return;
        }
        setOrderId(null);
        setLocalOrderId(result.localOrderId);
        setAppleProductId(result.productId);
        setAppleAccountToken(result.appAccountToken);
        setCheckoutStarted(true);
        return;
      }

      const result = await createGuestCheckoutOrder(signupDraft, selectedPlan, billingInterval);
      if ("error" in result) {
        setError(result.error ?? "Could not start checkout. Please try again.");
        return;
      }

      setOrderId(result.orderId);
      setLocalOrderId(result.localOrderId);
      setCheckoutStarted(true);
    } catch (err) {
      setError(formatUserError(err, "Could not start checkout. Please try again."));
    } finally {
      setIsPending(false);
    }
  };

  const backHref =
    searchParams.get("from") === "ios"
      ? IOS_WELCOME_PATH
      : intakeJson
        ? "/get-started"
        : "/";

  if (readyEmail !== null) {
    return (
      <>
        <AuthCardShell backHref="/">
          <Card className="w-full border-border/80 bg-background/95 shadow-xl backdrop-blur">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-black">You&apos;re in</CardTitle>
              <CardDescription>Your plan is active.</CardDescription>
            </CardHeader>
          </Card>
        </AuthCardShell>
        <OpenInAppDialog
          email={readyEmail}
          onContinue={() => router.push("/dashboard")}
        />
      </>
    );
  }

  if (
    checkoutStarted &&
    localOrderId &&
    (orderId || (useAppleIap && appleProductId && appleAccountToken))
  ) {
    return (
      <AuthCardShell backHref={backHref}>
      <Card className="w-full border-border/80 bg-background/95 shadow-xl backdrop-blur">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-black">Complete purchase</CardTitle>
          <CardDescription>
            Payment is required before your account is created.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          <div className="rounded-xl border border-border bg-secondary/30 p-3 text-left">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected package</p>
            {(() => {
              const basePrice = getPlanPrice(selectedPlan, billingInterval);
              const bestOffer = useAppleIap
                ? null
                : pickBestOffer(offers, selectedPlan, billingInterval);
              const discountedAmountCents = applyOfferDiscount(
                basePrice.amountCents,
                bestOffer
              );
              const displayPrice = getCurrencyPrice({ amountEurCents: discountedAmountCents });
              return (
                <p className="mt-1 text-base font-bold text-foreground">
                  {PACKAGE_OPTIONS.find((option) => option.id === selectedPlan)?.name} ·{" "}
                  {displayPrice.label}/{billingInterval === "monthly" ? "month" : "year"}
                </p>
              );
            })()}
          </div>
          {paymentPending ? (
            <div className="rounded-xl border border-border bg-secondary/30 py-8">
              <p className="flex items-center justify-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Finalizing your account...
              </p>
            </div>
          ) : useAppleIap && appleProductId && appleAccountToken ? (
            <AppleIapCheckout
              productId={appleProductId}
              appAccountToken={appleAccountToken}
              fallbackPriceLabel={getPlanPrice(selectedPlan, billingInterval).label}
              ctaLabel={platform.checkoutFlow.applePrimaryCta}
              preparingLabel={platform.checkoutFlow.preparing}
              processorNote={platform.checkoutFlow.appleProcessorNote}
              onError={setError}
              onPurchased={async (purchase) => {
                setError(null);
                setPaymentPending(true);
                try {
                  const result = await completeGuestAppleCheckout({
                    localOrderId,
                    productId: purchase.productId,
                    signedTransaction: purchase.signedTransaction,
                  });
                  if ("error" in result) {
                    setError(result.error ?? "Could not complete signup after payment.");
                    return;
                  }
                  finishSignup("client");
                } finally {
                  setPaymentPending(false);
                }
              }}
            />
          ) : orderId ? (
            <PokPayGuestCheckout
              orderId={orderId}
              locale={locale}
              email={signupDraft?.email}
              hideEmailField
              onSuccess={() => {
                setError(null);
                setPaymentPending(true);
                void completeGuestCheckoutAndSignIn(localOrderId)
                  .then((result) => {
                    if ("error" in result) {
                      setError(result.error ?? "Could not complete signup after payment.");
                      return;
                    }
                    finishSignup("client");
                  })
                  .finally(() => {
                    setPaymentPending(false);
                  });
              }}
              onError={(paymentError) => {
                const message =
                  typeof paymentError?.message === "string"
                    ? paymentError.message
                    : "Payment failed. Please try again.";
                setError(message);
              }}
            />
          ) : null}
          {error && <p className="text-red-400">{error}</p>}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setCheckoutStarted(false);
              setOrderId(null);
              setLocalOrderId(null);
              setAppleProductId(null);
              setAppleAccountToken(null);
              setError(null);
            }}
          >
            Back to package selection
          </Button>
        </CardContent>
      </Card>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell backHref={backHref}>
    <Card className="w-full border-border/80 bg-background/95 shadow-xl backdrop-blur">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-black">
          JOIN <BrandWordmark />
        </CardTitle>
        <CardDescription>
          {intakeJson
            ? "Your preferences are saved — complete package purchase to enter"
            : "Create your account and buy a package to enter"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {intakeJson ? (
          <div className="mb-4 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
            <div className="flex items-center gap-2 border-b border-primary/20 px-3.5 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">Health profile ready</p>
                <p className="text-[11px] text-muted-foreground">
                  Daily targets and a 4-week workout from your questionnaire
                </p>
              </div>
            </div>

            {macroTargets ? (
              <div className="space-y-3 p-3.5">
                <div className="flex items-center gap-3 rounded-xl bg-background/50 px-3 py-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
                    <Flame className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Daily calories
                    </p>
                    <p className="text-xl font-black leading-none tracking-tight">
                      {macroTargets.calories}
                      <span className="ml-1 text-sm font-semibold text-muted-foreground">
                        kcal
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        key: "protein",
                        label: "Protein",
                        value: macroTargets.protein,
                        icon: Beef,
                        color: "text-rose-400",
                        bg: "bg-rose-500/15",
                        bar: "bg-rose-500",
                      },
                      {
                        key: "carbs",
                        label: "Carbs",
                        value: macroTargets.carbs,
                        icon: Wheat,
                        color: "text-amber-400",
                        bg: "bg-amber-500/15",
                        bar: "bg-amber-500",
                      },
                      {
                        key: "fat",
                        label: "Fat",
                        value: macroTargets.fat,
                        icon: Droplets,
                        color: "text-sky-400",
                        bg: "bg-sky-500/15",
                        bar: "bg-sky-500",
                      },
                    ] as const
                  ).map((macro) => {
                    const Icon = macro.icon;
                    const max = Math.max(
                      macroTargets.protein,
                      macroTargets.carbs,
                      macroTargets.fat,
                      1
                    );
                    const width = Math.max(12, (macro.value / max) * 100);
                    return (
                      <div
                        key={macro.key}
                        className="rounded-xl border border-border/60 bg-background/40 px-2.5 py-2.5"
                      >
                        <div
                          className={cn(
                            "mb-2 flex h-7 w-7 items-center justify-center rounded-lg",
                            macro.bg,
                            macro.color
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {macro.label}
                        </p>
                        <p className="mt-0.5 text-base font-black leading-none">
                          {macro.value}
                          <span className="text-xs font-semibold text-muted-foreground">g</span>
                        </p>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn("h-full rounded-full", macro.bar)}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {workoutPreview ? <WorkoutPreviewRow preview={workoutPreview} /> : null}
              </div>
            ) : (
              <div className="space-y-3 p-3.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Your answers are saved and ready to apply.
                </div>
                {workoutPreview ? <WorkoutPreviewRow preview={workoutPreview} /> : null}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-dashed border-border bg-secondary/30 p-3 text-center text-sm text-muted-foreground">
            <p>Want macros & habits tailored to you?</p>
            <Link
              href="/get-started"
              className="mt-1 inline-block font-semibold text-primary hover:underline"
            >
              Get Your Custom Program first →
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input id="full_name" name="full_name" required placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="you@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" name="phone" type="tel" placeholder="+355 11 222 333 (Optional)" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" name="password" required minLength={6} />
          </div>
          <div className="rounded-2xl border border-border/70 bg-secondary/25 p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <TicketPercent className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Referral code</p>
                  <p className="text-xs text-muted-foreground">Optional discount or invite credit</p>
                </div>
              </div>
              <Input
                id="guest-referral-code"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="Enter code (Optional)"
                autoCapitalize="characters"
                autoCorrect="off"
                className="h-11"
              />
            </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-3">
            <input
              id="accept_terms"
              name="accept_terms"
              type="checkbox"
              required
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              I agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {error && !signupDraft ? <p className="text-sm text-red-400">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={isPending || !acceptedTerms}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing checkout...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Continue
              </>
            )}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={
              searchParams.get("from") === "ios"
                ? "/login?from=ios&next=%2Fdashboard"
                : "/login"
            }
            className="text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>

      <AppDialog
        open={signupDraft !== null}
        onClose={() => {
          if (isPending) return;
          setSignupDraft(null);
          setError(null);
        }}
        title="Choose your package"
        footer={
          <div className="space-y-2">
            {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
            <Button type="button" className="w-full" onClick={handleStartCheckout} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing checkout...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Continue to payment
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={isPending}
              onClick={() => {
                setSignupDraft(null);
                setError(null);
              }}
            >
              Back to account details
            </Button>
          </div>
        }
      >
        <div className="space-y-3 px-5 pb-2">
          <div className="mx-auto grid w-full max-w-[280px] grid-cols-2 gap-1 rounded-full border border-border/70 bg-secondary/25 p-0.5">
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                billingInterval === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setBillingInterval("monthly")}
              aria-pressed={billingInterval === "monthly"}
            >
              Monthly
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                billingInterval === "annual"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setBillingInterval("annual")}
              aria-pressed={billingInterval === "annual"}
            >
              Yearly
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {PACKAGE_OPTIONS.map((option) => {
              const selected = selectedPlan === option.id;
              const bestOffer = pickBestOffer(offers, option.id, billingInterval);
              const basePrice = getPlanPrice(option.id, billingInterval);
              const discountedAmountCents = applyOfferDiscount(basePrice.amountCents, bestOffer);
              const displayPrice = getCurrencyPrice({ amountEurCents: discountedAmountCents });
              const compareAtPrice =
                discountedAmountCents < basePrice.amountCents
                  ? getCurrencyPrice({ amountEurCents: basePrice.amountCents })
                  : null;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedPlan(option.id)}
                  aria-pressed={selected}
                  className={cn(
                    "relative rounded-2xl border-2 p-4 text-left transition-all",
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border/70 bg-secondary/30"
                  )}
                >
                  {selected ? (
                    <span
                      className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-background"
                      aria-hidden
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-black tracking-tight">{option.name}</p>
                        {option.badge ? (
                          <span className="inline-flex rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                            {option.badge}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex items-baseline justify-end gap-1.5">
                        {compareAtPrice ? (
                          <span className="text-sm font-medium text-muted-foreground line-through">
                            {compareAtPrice.label}
                          </span>
                        ) : null}
                        <p className="text-2xl font-black tracking-tight">{displayPrice.label}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        / {billingInterval === "monthly" ? "month" : "year"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </AppDialog>
    </AuthCardShell>
  );
}
