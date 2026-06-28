"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Sparkles } from "lucide-react";
import {
  completePendingSignup,
  completeRegistration,
  signInAfterRegistration,
  signUpAccount,
} from "@/lib/actions/auth";
import { BrandWordmark } from "@/components/app-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateMacrosFromIntakeResponses } from "@/lib/macro-calculator";
import { loadIntakeDraft, clearIntakeDraft } from "@/lib/intake-storage";
import { getOrCreateDeviceHash, loadReferralCode, saveReferralCode } from "@/lib/referral-storage";
import {
  formatUserError,
  isDirectSignupRejection,
  isMissingAdminCredentialsError,
} from "@/lib/format-user-error";

const ONBOARDING_PRICING = "/dashboard/pricing?onboarding=1";

type PendingSignup = {
  email: string;
  password: string;
  fullName: string;
  phone: string | null;
  intakeJson: string | null;
  referralCode: string | null;
  deviceHash: string;
};

export function RegisterForm({ initialReferralCode }: { initialReferralCode?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [intakeJson, setIntakeJson] = useState<string | null>(null);
  const [macroPreview, setMacroPreview] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null);
  const [continuePending, setContinuePending] = useState(false);
  const [continueMessage, setContinueMessage] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const draft = loadIntakeDraft();
    if (!draft) return;
    setIntakeJson(JSON.stringify(draft));
    const macros = calculateMacrosFromIntakeResponses(draft);
    if (macros) {
      setMacroPreview(
        `${macros.calories} cal · P${macros.protein} C${macros.carbs} F${macros.fat}`
      );
    }
  }, []);

  useEffect(() => {
    const code = initialReferralCode?.trim().toLowerCase() || loadReferralCode();
    if (code) {
      saveReferralCode(code);
      setReferralCode(code);
    }
  }, [initialReferralCode]);

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
    if (result?.error) {
      setError(
        formatUserError(
          result.error,
          "Account created but setup failed. Try signing in — your profile may already be ready."
        )
      );
      return;
    }

    finishSignup(result.role);
  };

  const handleContinueSetup = async () => {
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
        deviceHash: pendingSignup.deviceHash,
      });

      if (result?.error) {
        setContinueMessage(
          formatUserError(
            result.error,
            "Could not finish setting up your account. Try again in a minute."
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
    setIsPending(true);

    try {
      const form = e.currentTarget;
      const fullName = (new FormData(form).get("full_name") as string).trim();
      const email = (new FormData(form).get("email") as string).trim().toLowerCase();
      const phone = ((new FormData(form).get("phone") as string) || "").trim() || null;
      const password = new FormData(form).get("password") as string;
      const deviceHash = getOrCreateDeviceHash();

      const registrationInput = {
        fullName,
        email,
        phone,
        intakeJson,
        referralCode,
        deviceHash,
      };

      let serverResult: Awaited<ReturnType<typeof signUpAccount>> | undefined;

      try {
        serverResult = await signUpAccount({
          ...registrationInput,
          password,
        });
      } catch (err) {
        if (isMissingAdminCredentialsError(err)) {
          setError(
            "Registration is temporarily unavailable. Please try again in a few minutes or contact support."
          );
          return;
        }
        setError(formatUserError(err, "Could not create account. Please try again."));
        return;
      }

      if ("error" in serverResult && serverResult.error && isDirectSignupRejection(serverResult.error)) {
        setError(serverResult.error);
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

      setPendingSignup({ ...registrationInput, password });
      setNeedsEmailConfirmation(true);
      setError(signInResult.error);
    } catch (err) {
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
          <CardTitle className="text-2xl font-black">Almost there</CardTitle>
          <CardDescription>
            Your account for{" "}
            <span className="font-medium text-foreground">{pendingSignup.email}</span> is ready.
            Tap continue to finish setup — no confirmation email needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          <p>Your questionnaire answers are saved — they&apos;ll attach when you continue.</p>
          {error && <p className="text-red-400">{error}</p>}
          {continueMessage && (
            <p
              className={
                continueMessage.toLowerCase().includes("could not")
                  ? "text-red-400"
                  : "text-green-400"
              }
            >
              {continueMessage}
            </p>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={continuePending}
            onClick={() => void handleContinueSetup()}
          >
            {continuePending ? "Finishing setup..." : "Continue to my program"}
          </Button>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              Sign in instead
            </Button>
          </Link>
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
            ? "Your custom plan is ready — create your account to unlock it"
            : "Create your account to get started"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {intakeJson ? (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              Health profile attached
            </div>
            {macroPreview && (
              <p className="mt-1 text-muted-foreground">
                Estimated targets:{" "}
                <span className="font-medium text-foreground">{macroPreview}</span>
              </p>
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
            <Input id="phone" name="phone" type="tel" placeholder="+383 44 123 456" />
            <p className="text-xs text-muted-foreground">
              Optional — your coach may reach out if you need support.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" name="password" required minLength={6} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={isPending}>
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
