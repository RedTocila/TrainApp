"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";
import { BrandWordmark } from "@/components/app-logo";
import { AuthCardShell } from "@/components/auth-card-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  };

  return (
    <AuthCardShell backHref="/login">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-black">
            <BrandWordmark />
          </CardTitle>
          <CardDescription>
            {sent ? "Check your email" : "Reset your password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                If an account exists for that email, we sent a link to reset your
                password. The link expires after a short time.
              </p>
              <Link href="/login" className={cn(buttonVariants(), "w-full")}>
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <form action={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@email.com"
                    autoComplete="email"
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? "Sending..." : "Send reset link"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Remember your password?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </AuthCardShell>
  );
}
