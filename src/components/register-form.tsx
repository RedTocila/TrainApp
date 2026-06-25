"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Sparkles } from "lucide-react";
import { completeRegistration } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateMacrosFromIntakeResponses } from "@/lib/macro-calculator";
import { loadIntakeDraft, clearIntakeDraft } from "@/lib/intake-storage";

const ONBOARDING_PRICING = "/dashboard/pricing?onboarding=1";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [intakeJson, setIntakeJson] = useState<string | null>(null);
  const [macroPreview, setMacroPreview] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNeedsEmailConfirmation(false);
    setIsPending(true);

    const form = e.currentTarget;
    const fullName = (new FormData(form).get("full_name") as string).trim();
    const email = (new FormData(form).get("email") as string).trim();
    const phone = ((new FormData(form).get("phone") as string) || "").trim() || null;
    const password = new FormData(form).get("password") as string;

    const supabase = createClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(ONBOARDING_PRICING)}`;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsPending(false);
      return;
    }

    let hasSession = Boolean(signUpData.session);

    if (!hasSession) {
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setConfirmationEmail(email);
        setNeedsEmailConfirmation(true);
        setIsPending(false);
        return;
      }

      hasSession = Boolean(signInData.session);
    }

    if (!hasSession) {
      setConfirmationEmail(email);
      setNeedsEmailConfirmation(true);
      setIsPending(false);
      return;
    }

    const result = await completeRegistration({
      fullName,
      email,
      phone,
      intakeJson,
    });

    if (result?.error) {
      setError(result.error);
      setIsPending(false);
      return;
    }

    clearIntakeDraft();
    router.refresh();

    if (result.role === "admin") {
      router.push("/admin");
    } else {
      router.push(ONBOARDING_PRICING);
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
          JOIN <span className="text-primary">RUTINA</span>
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
            <Input id="password" name="password" type="password" required minLength={6} />
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
