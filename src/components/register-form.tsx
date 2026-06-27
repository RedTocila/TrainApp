"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Sparkles } from "lucide-react";
import { completeRegistration, signInAfterRegistration, signUpAccount } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";
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
  isEmailDeliverySignupError,
  isMissingAdminCredentialsError,
} from "@/lib/format-user-error";

const ONBOARDING_PRICING = "/dashboard/pricing?onboarding=1";

export function RegisterForm({ initialReferralCode }: { initialReferralCode?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [intakeJson, setIntakeJson] = useState<string | null>(null);
  const [macroPreview, setMacroPreview] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [resendPending, setResendPending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
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

  const emailRedirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(ONBOARDING_PRICING)}`
      : undefined;

  const handleResendConfirmation = async () => {
    if (!confirmationEmail || !emailRedirectTo) return;
    setResendPending(true);
    setResendMessage(null);
    setError(null);

    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: confirmationEmail,
        options: { emailRedirectTo },
      });

      if (resendError) {
        setResendMessage(
          formatUserError(
            resendError,
            "Could not resend the confirmation email. Try again in a few minutes."
          )
        );
        return;
      }

      setResendMessage("Confirmation email sent again. Check your inbox and spam folder.");
    } finally {
      setResendPending(false);
    }
  };

  const finishSignup = (role?: string) => {
    clearIntakeDraft();
    router.refresh();
    router.push(role === "admin" ? "/admin" : ONBOARDING_PRICING);
  };

  const signInAfterSignup = async (email: string, password: string) => {
    const result = await signInAfterRegistration(email, password);

    if (result.error) {
      setError(result.error);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResendMessage(null);
    setNeedsEmailConfirmation(false);
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

      let serverSignupError: string | null = null;
      let useClientSignup = false;

      try {
        const serverResult = await signUpAccount({
          ...registrationInput,
          password,
        });

        if (!serverResult?.error) {
          const signedIn = await signInAfterSignup(email, password);
          if (signedIn) {
            finishSignup(serverResult.role);
          }
          return;
        }

        serverSignupError = serverResult.error;
        if (isDirectSignupRejection(serverSignupError)) {
          setError(serverSignupError);
          return;
        }

        useClientSignup = true;
      } catch (err) {
        if (isMissingAdminCredentialsError(err)) {
          useClientSignup = true;
        } else {
          setError(formatUserError(err, "Could not create account. Please try again."));
          return;
        }
      }

      if (!useClientSignup) {
        setError(serverSignupError ?? "Could not create account. Please try again.");
        return;
      }

      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(ONBOARDING_PRICING)}`;

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            ...(phone ? { phone } : {}),
            device_hash: deviceHash,
            ...(referralCode ? { referral_code: referralCode } : {}),
          },
          emailRedirectTo: redirectTo,
        },
      });

      if (signUpError) {
        if (isEmailDeliverySignupError(signUpError)) {
          const fallback = await signUpAccount({
            ...registrationInput,
            password,
          });

          if (fallback?.error) {
            setError(
              serverSignupError ??
                formatUserError(
                  fallback.error,
                  "We could not finish creating your account. Try again in a few minutes or contact support."
                )
            );
            return;
          }

          const signedIn = await signInAfterSignup(email, password);
          if (signedIn) {
            finishSignup(fallback.role);
          }
          return;
        }

        setError(
          formatUserError(
            signUpError,
            serverSignupError ?? "Could not create account."
          )
        );
        return;
      }

      if (signUpData.user?.identities?.length === 0) {
        setError("This email is already registered. Sign in instead.");
        return;
      }

      let hasSession = Boolean(signUpData.session);

      if (!hasSession) {
        const signInResult = await signInAfterRegistration(email, password);

        if (signInResult.error) {
          setConfirmationEmail(email);
          setNeedsEmailConfirmation(true);
          setError(signInResult.error);
          return;
        }

        hasSession = true;
      }

      if (!hasSession) {
        setConfirmationEmail(email);
        setNeedsEmailConfirmation(true);
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
    } catch (err) {
      setError(formatUserError(err, "Could not create account. Please try again."));
    } finally {
      setIsPending(false);
    }
  };

  if (needsEmailConfirmation) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-black">Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{confirmationEmail}</span>.
            Click it to continue to your custom program.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          <p>Your questionnaire answers are saved — they&apos;ll attach when you confirm.</p>
          {resendMessage && (
            <p className={resendMessage.includes("sent again") ? "text-green-400" : "text-red-400"}>
              {resendMessage}
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={resendPending}
            onClick={() => void handleResendConfirmation()}
          >
            {resendPending ? "Sending..." : "Resend confirmation email"}
          </Button>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              Already confirmed? Sign in
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
