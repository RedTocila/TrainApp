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
  CheckCircle2,
  Loader2,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import {
  completeGuestCheckoutAndSignIn,
  createGuestCheckoutOrder,
  type GuestSignupPayload,
} from "@/lib/actions/guest-signup";
import { BrandWordmark } from "@/components/app-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PokPayGuestCheckout } from "@/components/pokpay-guest-checkout";
import {
  calculateMacrosFromIntakeResponses,
  type MacroTargets,
} from "@/lib/macro-calculator";
import { loadIntakeDraft, clearIntakeDraft } from "@/lib/intake-storage";
import { saveCheckoutReferralCode } from "@/lib/referral-storage";
import { formatUserError } from "@/lib/format-user-error";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";

type PackagePlan = "ai" | "elite";
type SignupDraft = GuestSignupPayload;

const PACKAGE_OPTIONS: Array<{
  id: PackagePlan;
  name: string;
  priceLabel: string;
  subtitle: string;
  features: string[];
}> = [
  {
    id: "ai",
    name: "RUTINA AI Pro",
    priceLabel: "€20",
    subtitle: "AI coaching and personalized fitness guidance.",
    features: [
      "AI Fitness Coach",
      "AI Nutrition Coach",
      "AI Workout Generator",
      "Personalized recommendations",
    ],
  },
  {
    id: "elite",
    name: "RUTINA Elite",
    priceLabel: "€30",
    subtitle: "Everything in AI Pro plus elite coaching and community.",
    features: [
      "Everything in AI Pro",
      "Live training classes",
      "Community challenges",
      "Priority support",
    ],
  },
];

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [intakeJson, setIntakeJson] = useState<string | null>(null);
  const [macroTargets, setMacroTargets] = useState<MacroTargets | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PackagePlan>("ai");
  const [signupDraft, setSignupDraft] = useState<SignupDraft | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [localOrderId, setLocalOrderId] = useState<string | null>(null);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);

  useEffect(() => {
    const draft = loadIntakeDraft();
    if (!draft) return;
    setIntakeJson(JSON.stringify(draft));
    const macros = calculateMacrosFromIntakeResponses(draft);
    if (macros) setMacroTargets(macros);
  }, []);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref?.trim()) saveCheckoutReferralCode(ref.trim());
  }, [searchParams]);

  const finishSignup = (role?: string) => {
    clearIntakeDraft();
    router.refresh();
    router.push(role === "admin" ? "/admin" : "/dashboard");
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

      const nextDraft: SignupDraft = {
        fullName,
        email,
        phone,
        password,
        intakeJson,
        referralCode: null,
      };
      setSignupDraft(nextDraft);
    } catch (err) {
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
      const result = await createGuestCheckoutOrder(signupDraft, selectedPlan, "monthly");
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

  if (checkoutStarted && orderId && localOrderId) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-black">Complete purchase</CardTitle>
          <CardDescription>
            Payment is required before your account is created.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          <div className="rounded-xl border border-border bg-secondary/30 p-3 text-left">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected package</p>
            <p className="mt-1 text-base font-bold text-foreground">
              {PACKAGE_OPTIONS.find((option) => option.id === selectedPlan)?.name} ·{" "}
              {PACKAGE_OPTIONS.find((option) => option.id === selectedPlan)?.priceLabel}
            </p>
          </div>
          {paymentPending ? (
            <div className="rounded-xl border border-border bg-secondary/30 py-8">
              <p className="flex items-center justify-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Finalizing your account...
              </p>
            </div>
          ) : (
            <PokPayGuestCheckout
              orderId={orderId}
              locale={locale}
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
          )}
          {error && <p className="text-red-400">{error}</p>}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setCheckoutStarted(false);
              setOrderId(null);
              setLocalOrderId(null);
              setError(null);
            }}
          >
            Back to package selection
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (signupDraft) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-black">Choose your package</CardTitle>
          <CardDescription>
            Review package details and continue to payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary/20 p-3 text-sm">
            <p className="font-semibold text-foreground">{signupDraft.fullName}</p>
            <p className="text-muted-foreground">{signupDraft.email}</p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {PACKAGE_OPTIONS.map((option) => {
              const selected = selectedPlan === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedPlan(option.id)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/20 hover:bg-secondary/30"
                  )}
                  aria-pressed={selected}
                >
                  <p className="text-sm font-semibold">{option.name}</p>
                  <p className="text-xs text-muted-foreground">{option.priceLabel} / month</p>
                  <p className="mt-2 text-xs text-muted-foreground">{option.subtitle}</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {option.features.map((feature) => (
                      <li key={feature}>- {feature}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            You must complete payment before account access is granted.
          </p>

          {error && <p className="text-sm text-red-400">{error}</p>}

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
            onClick={() => {
              setSignupDraft(null);
              setError(null);
            }}
          >
            Back to account details
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
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
                  Daily targets from your questionnaire
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
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-3 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Your answers are saved and ready to apply.
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
            <p className="text-xs text-muted-foreground">
              Optional — your coach may reach out if you need support.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" name="password" required minLength={6} />
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
          {error && <p className="text-sm text-red-400">{error}</p>}
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
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
