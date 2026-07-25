"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Sparkles, Flame, Beef, Wheat, Droplets, CheckCircle2 } from "lucide-react";
import {
  completePendingSignup,
  completeRegistration,
  resumeExistingAccount,
  signInAfterRegistration,
  signUpAccount,
} from "@/lib/actions/auth";
import { BrandWordmark } from "@/components/app-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateMacrosFromIntakeResponses,
  type MacroTargets,
} from "@/lib/macro-calculator";
import { loadIntakeDraft, clearIntakeDraft } from "@/lib/intake-storage";
import {
  formatUserError,
  isDirectSignupRejection,
} from "@/lib/format-user-error";
import { cn } from "@/lib/utils";

const ONBOARDING_PRICING = "/dashboard/pricing?onboarding=1";

type PendingSignup = {
  email: string;
  password: string;
  fullName: string;
  phone: string | null;
  intakeJson: string | null;
  referralCode: string | null;
};

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [intakeJson, setIntakeJson] = useState<string | null>(null);
  const [macroTargets, setMacroTargets] = useState<MacroTargets | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [existingAccount, setExistingAccount] = useState<PendingSignup | null>(null);
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null);
  const [continuePending, setContinuePending] = useState(false);
  const [continueMessage, setContinueMessage] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    const draft = loadIntakeDraft();
    if (!draft) return;
    setIntakeJson(JSON.stringify(draft));
    const macros = calculateMacrosFromIntakeResponses(draft);
    if (macros) setMacroTargets(macros);
  }, []);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref?.trim()) setReferralCode(ref.trim());
  }, [searchParams]);

  const finishSignup = (role?: string) => {
    clearIntakeDraft();
    router.refresh();
    router.push(role === "admin" ? "/admin" : ONBOARDING_PRICING);
  };

  const finishAfterSignIn = async (
    registrationInput: Omit<PendingSignup, "password">,
    serverAlreadyFinalized: boolean,
    role?: string
  ) => {
    if (serverAlreadyFinalized) {
      finishSignup(role);
      return;
    }

    router.refresh();
    const result = await completeRegistration(registrationInput);
    if (!result || "error" in result) {
      setError(
        formatUserError(
          result?.error ?? "Unknown error",
          "Account created but setup failed. Try signing in — your profile may already be ready."
        )
      );
      return;
    }

    finishSignup(result.role);
  };

  const handleContinueAfterConfirm = async () => {
    if (!pendingSignup) return;
    setContinuePending(true);
    setContinueMessage(null);
    setError(null);

    try {
      const result = await completePendingSignup({
        fullName: pendingSignup.fullName,
        email: pendingSignup.email,
        phone: pendingSignup.phone,
        password: pendingSignup.password,
        intakeJson: pendingSignup.intakeJson,
        referralCode: pendingSignup.referralCode,
      });

      if (!result || "error" in result) {
        setContinueMessage(
          formatUserError(
            result?.error ?? "Unknown error",
            "Could not continue yet. Try signing in with the same email and password."
          )
        );
        return;
      }

      finishSignup(result.role);
    } finally {
      setContinuePending(false);
    }
  };

  const handleResumeExisting = async () => {
    if (!existingAccount) return;
    setContinuePending(true);
    setError(null);
    setContinueMessage(null);

    try {
      const result = await resumeExistingAccount({
        fullName: existingAccount.fullName,
        email: existingAccount.email,
        phone: existingAccount.phone,
        password: existingAccount.password,
        intakeJson: existingAccount.intakeJson,
        referralCode: existingAccount.referralCode,
      });

      if (!result || "error" in result) {
        setContinueMessage(
          formatUserError(
            result?.error ?? "Unknown error",
            "Could not sign in. Use Sign in with your password, or reset it if needed."
          )
        );
        return;
      }

      finishSignup(result.role);
    } finally {
      setContinuePending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setContinueMessage(null);
    setNeedsEmailConfirmation(false);
    setPendingSignup(null);
    setExistingAccount(null);

    if (!acceptedTerms) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setIsPending(true);

    try {
      const form = e.currentTarget;
      const fullName = (new FormData(form).get("full_name") as string).trim();
      const email = (new FormData(form).get("email") as string).trim().toLowerCase();
      const phone = ((new FormData(form).get("phone") as string) || "").trim() || null;
      const password = new FormData(form).get("password") as string;
      const referralFromForm =
        ((new FormData(form).get("referral_code") as string) || "").trim() ||
        referralCode.trim() ||
        null;

      const registrationInput = {
        fullName,
        email,
        phone,
        intakeJson,
        referralCode: referralFromForm,
      };

      console.log("[RegisterForm] signup submit", {
        email,
        fullName,
        hasPhone: Boolean(phone),
        hasIntake: Boolean(intakeJson),
      });

      let serverResult: Awaited<ReturnType<typeof signUpAccount>>;

      try {
        serverResult = await signUpAccount({
          ...registrationInput,
          password,
        });
      } catch (err) {
        console.error("[RegisterForm] signUpAccount threw", err);
        setError(formatUserError(err, "Could not create account. Please try again."));
        return;
      }

      console.log("[RegisterForm] signUpAccount result", serverResult);

      if ("existingAccount" in serverResult && serverResult.existingAccount) {
        setExistingAccount({ ...registrationInput, password });
        setError(serverResult.error ?? "This email is already registered.");
        return;
      }

      if ("error" in serverResult && serverResult.error) {
        if (isDirectSignupRejection(serverResult.error)) {
          setError(serverResult.error);
          return;
        }
        setError(serverResult.error);
        return;
      }

      if (
        "needsEmailConfirmation" in serverResult &&
        serverResult.needsEmailConfirmation
      ) {
        setPendingSignup({ ...registrationInput, password });
        setNeedsEmailConfirmation(true);
        return;
      }

      const signInResult = await signInAfterRegistration(email, password);
      if (!signInResult.error) {
        await finishAfterSignIn(
          registrationInput,
          "success" in serverResult &&
            serverResult.success === true &&
            !("profileSetupDeferred" in serverResult && serverResult.profileSetupDeferred),
          "success" in serverResult && serverResult.success ? serverResult.role : undefined
        );
        return;
      }

      // Access unlocked but client session missing — resume with password.
      const resumed = await resumeExistingAccount({
        ...registrationInput,
        password,
      });
      if (!resumed || "error" in resumed) {
        setError(signInResult.error ?? resumed?.error ?? "Could not open your account.");
        return;
      }
      finishSignup(resumed.role);
    } catch (err) {
      console.error("[RegisterForm] unexpected signup error", err);
      setError(formatUserError(err, "Could not create account. Please try again."));
    } finally {
      setIsPending(false);
    }
  };

  if (needsEmailConfirmation && pendingSignup) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-black">Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to{" "}
            <span className="font-medium text-foreground">{pendingSignup.email}</span>.
            You can verify anytime — continue into the app now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          <p>Your questionnaire answers stay on this device until you finish setup.</p>
          {error && <p className="text-red-400">{error}</p>}
          {continueMessage && <p className="text-red-400">{continueMessage}</p>}
          <Button
            type="button"
            className="w-full"
            disabled={continuePending}
            onClick={() => void handleContinueAfterConfirm()}
          >
            {continuePending ? "Opening…" : "Continue to app"}
          </Button>
          <Link href={`/login?email=${encodeURIComponent(pendingSignup.email)}`}>
            <Button variant="outline" className="w-full">
              Sign in instead
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (existingAccount) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-black">Welcome back</CardTitle>
          <CardDescription>
            <span className="font-medium text-foreground">{existingAccount.email}</span> already
            has an account. Continue where you left off — no need to register again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          {error && <p className="text-red-400">{error}</p>}
          {continueMessage && <p className="text-red-400">{continueMessage}</p>}
          <Button
            type="button"
            className="w-full"
            disabled={continuePending}
            onClick={() => void handleResumeExisting()}
          >
            {continuePending ? "Opening…" : "Continue to app"}
          </Button>
          <Link href={`/login?email=${encodeURIComponent(existingAccount.email)}`}>
            <Button variant="outline" className="w-full">
              Sign in with password
            </Button>
          </Link>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setExistingAccount(null);
              setError(null);
              setContinueMessage(null);
            }}
          >
            Use a different email
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
            ? "Your preferences are saved — create your account to continue"
            : "Create your account to get started"}
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
          <div className="space-y-2">
            <Label htmlFor="referral_code">Referral code (optional)</Label>
            <Input
              id="referral_code"
              name="referral_code"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="Friend's code"
              autoCapitalize="off"
              autoCorrect="off"
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
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={isPending || !acceptedTerms}>
            {isPending ? "Creating account..." : "Create Account"}
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
