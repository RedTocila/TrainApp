"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { activateSubscriptionFromLocalOrder } from "@/lib/actions/subscriptions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const localOrderId = searchParams.get("localOrderId");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!localOrderId) {
      setStatus("error");
      setMessage("Missing order reference.");
      return;
    }

    startTransition(async () => {
      const result = await activateSubscriptionFromLocalOrder(localOrderId);
      if ("error" in result && result.error) {
        setStatus("error");
        setMessage(result.error);
        return;
      }
      setStatus("success");
    });
  }, [localOrderId]);

  return (
    <div className="mx-auto max-w-md pt-8">
      <Card>
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <CardTitle className="mt-4">Confirming payment…</CardTitle>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
              <CardTitle className="mt-4">You&apos;re subscribed!</CardTitle>
            </>
          )}
          {status === "error" && (
            <CardTitle>Payment confirmation</CardTitle>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "success" && (
            <p className="text-sm text-muted-foreground">
              Your subscription is active. You can now add workouts, meals, habits, and more.
            </p>
          )}
          {status === "error" && (
            <p className="text-sm text-red-400">
              {message ?? "We could not confirm your payment yet. If you were charged, contact support."}
            </p>
          )}
          <Link href="/dashboard">
            <Button className="w-full">Go to dashboard</Button>
          </Link>
          {status === "error" && (
            <Link href="/dashboard/pricing">
              <Button variant="outline" className="w-full">
                Back to pricing
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
